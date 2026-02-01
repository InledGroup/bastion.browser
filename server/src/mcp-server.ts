import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import express from "express";
import cors from "cors";
import { chromium, Browser, BrowserContext, Page, Locator } from "playwright";
import fs from "fs";
import { execSync } from "child_process";

const app = express();
app.use(cors());
const port = Number(process.env.MCP_PORT) || 3001;

const server = new Server(
  {
    name: "bastion-browser-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

let browser: Browser | null = null;
let context: BrowserContext | null = null;
let pages: Page[] = [];
let currentPageIndex = 0;

const consoleMessages: any[] = [];
const networkRequests: any[] = [];

async function getBrowser() {
  if (!browser) {
    try {
      // Connect to the existing browser started by the main server
      browser = await chromium.connectOverCDP('http://localhost:9222');
      console.log('Connected MCP to shared browser via CDP');
      
      const contexts = browser.contexts();
      context = contexts.length > 0 ? contexts[0] : await browser.newContext();
      
      context.on("page", (page) => {
        pages.push(page);
        setupPageListeners(page);
      });
      
      pages = context.pages();
      for (const p of pages) setupPageListeners(p);
      
    } catch (e) {
      console.log('Could not connect to shared browser, launching standalone...');
      const isHeadless = process.env.HEADLESS !== "false";
      browser = await chromium.launch({ 
        headless: isHeadless,
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
      });
      context = await browser.newContext();
      context.on("page", (page) => {
        pages.push(page);
        setupPageListeners(page);
      });
      await context.newPage();
    }
  }
  return browser;
}

function setupPageListeners(page: Page) {
  page.on("console", (msg) => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text(),
      location: msg.location(),
      timestamp: Date.now(),
    });
  });

  page.on("request", (request) => {
    networkRequests.push({
      method: request.method(),
      url: request.url(),
      headers: request.headers(),
      timestamp: Date.now(),
    });
  });
}

function getCurrentPage() {
  if (pages.length === 0) throw new Error("No pages open");
  return pages[currentPageIndex];
}

async function getElementByRef(page: Page, ref: string): Promise<Locator> {
  if (ref.startsWith("//") || ref.startsWith("(//")) {
    return page.locator(`xpath=${ref}`);
  }
  return page.locator(ref);
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "browser_navigate",
        description: "Navigate to a URL",
        inputSchema: {
          type: "object",
          properties: {
            url: { type: "string" },
          },
          required: ["url"],
        },
      },
      {
        name: "browser_snapshot",
        description: "Capture accessibility snapshot of the current page",
        inputSchema: {
          type: "object",
          properties: {
            filename: { type: "string" },
          },
        },
      },
      {
        name: "browser_click",
        description: "Perform click on a web page",
        inputSchema: {
          type: "object",
          properties: {
            element: { type: "string" },
            ref: { type: "string" },
            doubleClick: { type: "boolean" },
            button: { type: "string", enum: ["left", "right", "middle"] },
            modifiers: { type: "array", items: { type: "string" } },
          },
          required: ["ref"],
        },
      },
      {
        name: "browser_type",
        description: "Type text into editable element",
        inputSchema: {
          type: "object",
          properties: {
            element: { type: "string" },
            ref: { type: "string" },
            text: { type: "string" },
            submit: { type: "boolean" },
            slowly: { type: "boolean" },
          },
          required: ["ref", "text"],
        },
      },
      {
          name: "browser_close",
          description: "Close the page",
          inputSchema: { type: "object", properties: {} }
      },
      {
          name: "browser_console_messages",
          description: "Returns all console messages",
          inputSchema: {
              type: "object",
              properties: {
                  level: { type: "string", default: "info" },
                  filename: { type: "string" }
              }
          }
      },
      {
          name: "browser_drag",
          description: "Perform drag and drop between two elements",
          inputSchema: {
              type: "object",
              properties: {
                  startElement: { type: "string" },
                  startRef: { type: "string" },
                  endElement: { type: "string" },
                  endRef: { type: "string" }
              },
              required: ["startRef", "endRef"]
          }
      },
      {
          name: "browser_evaluate",
          description: "Evaluate JavaScript expression on page or element",
          inputSchema: {
              type: "object",
              properties: {
                  function: { type: "string" },
                  element: { type: "string" },
                  ref: { type: "string" }
              },
              required: ["function"]
          }
      },
      {
          name: "browser_file_upload",
          description: "Upload one or multiple files",
          inputSchema: {
              type: "object",
              properties: {
                  paths: { type: "array", items: { type: "string" } }
              }
          }
      },
      {
          name: "browser_fill_form",
          description: "Fill multiple form fields",
          inputSchema: {
              type: "object",
              properties: {
                  fields: { type: "array", items: { 
                      type: "object", 
                      properties: {
                          ref: { type: "string" },
                          value: { type: "string" }
                      },
                      required: ["ref", "value"]
                  } }
              },
              required: ["fields"]
          }
      },
      {
          name: "browser_handle_dialog",
          description: "Handle a dialog",
          inputSchema: {
              type: "object",
              properties: {
                  accept: { type: "boolean" },
                  promptText: { type: "string" }
              },
              required: ["accept"]
          }
      },
      {
          name: "browser_hover",
          description: "Hover over element on page",
          inputSchema: {
              type: "object",
              properties: {
                  element: { type: "string" },
                  ref: { type: "string" }
              },
              required: ["ref"]
          }
      },
      {
          name: "browser_navigate_back",
          description: "Go back to the previous page in the history",
          inputSchema: { type: "object", properties: {} }
      },
      {
          name: "browser_network_requests",
          description: "List network requests since loading the page",
          inputSchema: {
              type: "object",
              properties: {
                  includeStatic: { type: "boolean", default: false },
                  filename: { type: "string" }
              }
          }
      },
      {
          name: "browser_press_key",
          description: "Press a key on the keyboard",
          inputSchema: {
              type: "object",
              properties: {
                  key: { type: "string" }
              },
              required: ["key"]
          }
      },
      {
          name: "browser_resize",
          description: "Resize the browser window",
          inputSchema: {
              type: "object",
              properties: {
                  width: { type: "number" },
                  height: { type: "number" }
              },
              required: ["width", "height"]
          }
      },
      {
          name: "browser_run_code",
          description: "Run Playwright code snippet",
          inputSchema: {
              type: "object",
              properties: {
                  code: { type: "string" }
              },
              required: ["code"]
          }
      },
      {
          name: "browser_select_option",
          description: "Select an option in a dropdown",
          inputSchema: {
              type: "object",
              properties: {
                  element: { type: "string" },
                  ref: { type: "string" },
                  values: { type: "array", items: { type: "string" } }
              },
              required: ["ref", "values"]
          }
      },
      {
          name: "browser_take_screenshot",
          description: "Take a screenshot of the current page",
          inputSchema: {
              type: "object",
              properties: {
                  type: { type: "string", default: "png" },
                  filename: { type: "string" },
                  element: { type: "string" },
                  ref: { type: "string" },
                  fullPage: { type: "boolean" }
              }
          }
      },
      {
          name: "browser_wait_for",
          description: "Wait for text to appear or disappear or a specified time to pass",
          inputSchema: {
              type: "object",
              properties: {
                  time: { type: "number" },
                  text: { type: "string" },
                  textGone: { type: "string" }
              }
          }
      },
      {
          name: "browser_tabs",
          description: "Manage tabs",
          inputSchema: {
              type: "object",
              properties: {
                  action: { type: "string", enum: ["list", "create", "close", "select"] },
                  index: { type: "number" }
              },
              required: ["action"]
          }
      },
      {
          name: "browser_install",
          description: "Install the browser specified in the config",
          inputSchema: { type: "object", properties: {} }
      },
      {
          name: "browser_mouse_click_xy",
          description: "Click left mouse button at a given position",
          inputSchema: {
              type: "object",
              properties: {
                  x: { type: "number" },
                  y: { type: "number" }
              },
              required: ["x", "y"]
          }
      },
      {
          name: "browser_mouse_down",
          description: "Press mouse down",
          inputSchema: {
              type: "object",
              properties: {
                  button: { type: "string", default: "left" }
              }
          }
      },
      {
          name: "browser_mouse_drag_xy",
          description: "Drag left mouse button to a given position",
          inputSchema: {
              type: "object",
              properties: {
                  startX: { type: "number" },
                  startY: { type: "number" },
                  endX: { type: "number" },
                  endY: { type: "number" }
              },
              required: ["startX", "startY", "endX", "endY"]
          }
      },
      {
          name: "browser_mouse_move_xy",
          description: "Move mouse to a given position",
          inputSchema: {
              type: "object",
              properties: {
                  x: { type: "number" },
                  y: { type: "number" }
              },
              required: ["x", "y"]
          }
      },
      {
          name: "browser_mouse_up",
          description: "Press mouse up",
          inputSchema: {
              type: "object",
              properties: {
                  button: { type: "string", default: "left" }
              }
          }
      },
      {
          name: "browser_mouse_wheel",
          description: "Scroll mouse wheel",
          inputSchema: {
              type: "object",
              properties: {
                  deltaX: { type: "number" },
                  deltaY: { type: "number" }
              },
              required: ["deltaX", "deltaY"]
          }
      },
      {
          name: "browser_pdf_save",
          description: "Save page as PDF",
          inputSchema: {
              type: "object",
              properties: {
                  filename: { type: "string" }
              }
          }
      },
      {
          name: "browser_generate_locator",
          description: "Create locator for element",
          inputSchema: {
              type: "object",
              properties: {
                  element: { type: "string" },
                  ref: { type: "string" }
              },
              required: ["ref"]
          }
      },
      {
          name: "browser_verify_element_visible",
          description: "Verify element is visible on the page",
          inputSchema: {
              type: "object",
              properties: {
                  role: { type: "string" },
                  accessibleName: { type: "string" }
              },
              required: ["role", "accessibleName"]
          }
      },
      {
          name: "browser_verify_list_visible",
          description: "Verify list is visible on the page",
          inputSchema: {
              type: "object",
              properties: {
                  element: { type: "string" },
                  ref: { type: "string" },
                  items: { type: "array", items: { type: "string" } }
              },
              required: ["ref", "items"]
          }
      },
      {
          name: "browser_verify_text_visible",
          description: "Verify text is visible on the page",
          inputSchema: {
              type: "object",
              properties: {
                  text: { type: "string" }
              },
              required: ["text"]
          }
      },
      {
          name: "browser_verify_value",
          description: "Verify element value",
          inputSchema: {
              type: "object",
              properties: {
                  type: { type: "string" },
                  element: { type: "string" },
                  ref: { type: "string" },
                  value: { type: "string" }
              },
              required: ["ref", "value"]
          }
      }
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  await getBrowser();
  const page = getCurrentPage();

  // Signal activity to the UI via a custom console message
  await page.evaluate(() => console.log('__BASTION_AI_ACTIVE__')).catch(() => {});

  try {
    switch (name) {
      case "browser_navigate":
        await page.goto(args!.url as string, { waitUntil: "domcontentloaded" });
        await page.evaluate((url) => {
          document.title = `[AI] ${document.title || url}`;
        }, args!.url).catch(() => {});
        return { content: [{ type: "text", text: `Navigated to ${args!.url}` }] };

      case "browser_snapshot": {
        const snapshot = await (page as any).accessibility.snapshot();
        const snapshotText = JSON.stringify(snapshot, null, 2);
        if (args?.filename) {
          fs.writeFileSync(args.filename as string, snapshotText);
          return { content: [{ type: "text", text: `Snapshot saved to ${args.filename}` }] };
        }
        return { content: [{ type: "text", text: snapshotText }] };
      }

      case "browser_click": {
        const element = await getElementByRef(page, args!.ref as string);
        await element.click({
          button: (args!.button as any) || "left",
          clickCount: args!.doubleClick ? 2 : 1,
          modifiers: args!.modifiers as any,
        });
        return { content: [{ type: "text", text: `Clicked ${args!.ref}` }] };
      }

      case "browser_type": {
        const element = await getElementByRef(page, args!.ref as string);
        if (args!.slowly) {
          await element.type(args!.text as string, { delay: 100 });
        } else {
          await element.fill(args!.text as string);
        }
        if (args!.submit) {
          await page.keyboard.press("Enter");
        }
        return { content: [{ type: "text", text: `Typed into ${args!.ref}` }] };
      }

      case "browser_close":
        await page.close();
        pages = pages.filter(p => p !== page);
        if (currentPageIndex >= pages.length) currentPageIndex = Math.max(0, pages.length - 1);
        return { content: [{ type: "text", text: "Page closed" }] };

      case "browser_console_messages": {
          const level = (args?.level as string) || "info";
          const filtered = consoleMessages.filter(m => {
              if (level === "error") return m.type === "error";
              if (level === "warning") return m.type === "error" || m.type === "warning";
              return true;
          });
          const text = JSON.stringify(filtered, null, 2);
          if (args?.filename) {
              fs.writeFileSync(args.filename as string, text);
              return { content: [{ type: "text", text: `Console messages saved to ${args.filename}` }] };
          }
          return { content: [{ type: "text", text }] };
      }

      case "browser_drag": {
          const start = await getElementByRef(page, args!.startRef as string);
          const end = await getElementByRef(page, args!.endRef as string);
          await start.dragTo(end);
          return { content: [{ type: "text", text: `Dragged from ${args!.startRef} to ${args!.endRef}` }] };
      }

      case "browser_evaluate": {
          const result = await page.evaluate(args!.function as string, args!.ref ? await getElementByRef(page, args!.ref as string) : undefined);
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "browser_file_upload": {
          await page.setInputFiles('input[type="file"]', args!.paths as string[]);
          return { content: [{ type: "text", text: "Files uploaded" }] };
      }

      case "browser_fill_form": {
          for (const field of (args!.fields as any[])) {
              const element = await getElementByRef(page, field.ref);
              await element.fill(field.value);
          }
          return { content: [{ type: "text", text: "Form filled" }] };
      }

      case "browser_handle_dialog": {
          page.once('dialog', async dialog => {
              if (args!.accept) await dialog.accept(args!.promptText as string);
              else await dialog.dismiss();
          });
          return { content: [{ type: "text", text: "Dialog handler set" }] };
      }

      case "browser_hover": {
          const element = await getElementByRef(page, args!.ref as string);
          await element.hover();
          return { content: [{ type: "text", text: `Hovered over ${args!.ref}` }] };
      }

      case "browser_navigate_back":
          await page.goBack();
          return { content: [{ type: "text", text: "Went back" }] };

      case "browser_network_requests": {
          const filtered = networkRequests.filter(r => args!.includeStatic || !r.url.match(/\.(png|jpg|jpeg|gif|svg|woff|woff2|ttf|css)$/));
          const text = JSON.stringify(filtered, null, 2);
          if (args?.filename) {
              fs.writeFileSync(args.filename as string, text);
              return { content: [{ type: "text", text: `Network requests saved to ${args.filename}` }] };
          }
          return { content: [{ type: "text", text }] };
      }

      case "browser_press_key":
          await page.keyboard.press(args!.key as string);
          return { content: [{ type: "text", text: `Pressed ${args!.key}` }] };

      case "browser_resize":
          await page.setViewportSize({ width: args!.width as number, height: args!.height as number });
          return { content: [{ type: "text", text: `Resized to ${args!.width}x${args!.height}` }] };

      case "browser_run_code": {
          const fn = new Function('page', `return (${args!.code})(page)`);
          const result = await fn(page);
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "browser_select_option": {
          const element = await getElementByRef(page, args!.ref as string);
          await element.selectOption(args!.values as string[]);
          return { content: [{ type: "text", text: `Selected options in ${args!.ref}` }] };
      }

      case "browser_take_screenshot": {
          const options: any = { type: args?.type || 'png', fullPage: args?.fullPage };
          if (args?.ref) {
              const element = await getElementByRef(page, args.ref as string);
              const buffer = await element.screenshot(options);
              if (args.filename) fs.writeFileSync(args.filename as string, buffer);
              return { content: [{ type: "text", text: `Screenshot of ${args.ref} saved` }, { type: "image", data: buffer.toString('base64'), mimeType: `image/${options.type}` }] };
          } else {
              const buffer = await page.screenshot(options);
              if (args?.filename) fs.writeFileSync(args.filename as string, buffer);
              return { content: [{ type: "text", text: `Page screenshot saved` }, { type: "image", data: buffer.toString('base64'), mimeType: `image/${options.type}` }] };
          }
      }

      case "browser_wait_for": {
          if (args?.time) await page.waitForTimeout((args.time as number) * 1000);
          if (args?.text) await page.waitForSelector(`text=${args.text}`);
          if (args?.textGone) await page.waitForSelector(`text=${args.textGone}`, { state: 'hidden' });
          return { content: [{ type: "text", text: "Wait finished" }] };
      }

      case "browser_tabs": {
          if (args!.action === "list") {
              const list = pages.map((p, i) => ({ index: i, url: p.url(), title: "Page" }));
              return { content: [{ type: "text", text: JSON.stringify(list, null, 2) }] };
          } else if (args!.action === "create") {
              await context!.newPage();
              return { content: [{ type: "text", text: "Tab created" }] };
          } else if (args!.action === "close") {
              const idx = args!.index !== undefined ? (args!.index as number) : currentPageIndex;
              await pages[idx].close();
              pages.splice(idx, 1);
              if (currentPageIndex >= pages.length) currentPageIndex = Math.max(0, pages.length - 1);
              return { content: [{ type: "text", text: "Tab closed" }] };
          } else if (args!.action === "select") {
              currentPageIndex = args!.index as number;
              await pages[currentPageIndex].bringToFront();
              return { content: [{ type: "text", text: `Tab ${args!.index} selected` }] };
          }
          return { content: [{ type: "text", text: "Invalid action" }] };
      }

      case "browser_install":
          execSync("npx playwright install chromium");
          return { content: [{ type: "text", text: "Browsers installed" }] };

      case "browser_mouse_click_xy":
          await page.mouse.click(args!.x as number, args!.y as number);
          return { content: [{ type: "text", text: `Clicked at ${args!.x}, ${args!.y}` }] };

      case "browser_mouse_down":
          await page.mouse.down({ button: (args?.button as any) || "left" });
          return { content: [{ type: "text", text: "Mouse button down" }] };

      case "browser_mouse_drag_xy":
          await page.mouse.move(args!.startX as number, args!.startY as number);
          await page.mouse.down();
          await page.mouse.move(args!.endX as number, args!.endY as number);
          await page.mouse.up();
          return { content: [{ type: "text", text: `Dragged from ${args!.startX},${args!.startY} to ${args!.endX},${args!.endY}` }] };

      case "browser_mouse_move_xy":
          await page.mouse.move(args!.x as number, args!.y as number);
          return { content: [{ type: "text", text: `Moved mouse to ${args!.x}, ${args!.y}` }] };

      case "browser_mouse_up":
          await page.mouse.up({ button: (args?.button as any) || "left" });
          return { content: [{ type: "text", text: "Mouse button up" }] };

      case "browser_mouse_wheel":
          await page.mouse.wheel(args!.deltaX as number, args!.deltaY as number);
          return { content: [{ type: "text", text: "Scrolled mouse wheel" }] };

      case "browser_pdf_save": {
          const buffer = await page.pdf();
          const filename = (args?.filename as string) || `page-${Date.now()}.pdf`;
          fs.writeFileSync(filename, buffer);
          return { content: [{ type: "text", text: `PDF saved to ${filename}` }] };
      }

      case "browser_generate_locator": {
          return { content: [{ type: "text", text: args!.ref as string }] };
      }

      case "browser_verify_element_visible": {
          const isVisible = await page.locator(`role=${args!.role}[name="${args!.accessibleName}"]`).isVisible();
          return { content: [{ type: "text", text: isVisible ? "Visible" : "Not visible" }] };
      }

      case "browser_verify_list_visible": {
          const list = await getElementByRef(page, args!.ref as string);
          for (const item of (args!.items as string[])) {
              const found = await list.locator(`text=${item}`).isVisible();
              if (!found) return { content: [{ type: "text", text: `Item "${item}" not found in list` }] };
          }
          return { content: [{ type: "text", text: "All items visible in list" }] };
      }

      case "browser_verify_text_visible": {
          const isVisible = await page.locator(`text=${args!.text}`).isVisible();
          return { content: [{ type: "text", text: isVisible ? "Visible" : "Not visible" }] };
      }

      case "browser_verify_value": {
          const element = await getElementByRef(page, args!.ref as string);
          const value = await element.inputValue();
          return { content: [{ type: "text", text: value === args!.value ? "Value matches" : `Value mismatch: expected ${args!.value}, got ${value}` }] };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

let transport: SSEServerTransport | null = null;

app.get("/sse", async (req, res) => {
  console.log("GET /sse - Starting SSE connection");
  transport = new SSEServerTransport("/sse", res);
  await server.connect(transport);
  console.log("SSE transport connected");
});

app.post("/sse", async (req, res) => {
  console.log("POST /sse - Received message");
  if (transport) {
    try {
      await transport.handlePostMessage(req, res);
      console.log("Message handled successfully");
    } catch (err) {
      console.error("Error handling POST message:", err);
      res.status(500).send("Internal Server Error");
    }
  } else {
    console.error("POST /sse - No active transport");
    res.status(400).send("No active SSE transport");
  }
});

app.listen(port, "0.0.0.0", () => {
  console.log(`MCP Server running on http://0.0.0.0:${port}/sse`);
});