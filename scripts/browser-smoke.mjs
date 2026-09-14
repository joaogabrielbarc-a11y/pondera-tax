// Run against a GitHub Pages build. Set PONDERA_PLAYWRIGHT_MODULE when using a
// separately installed Playwright. Optional PONDERA_CHROMIUM_MODULE supplies
// a packaged Chromium binary for environments without installed browsers.
import { createServer } from "node:http";
import { readFile, stat, mkdir } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const { chromium } = require(
  process.env.PONDERA_PLAYWRIGHT_MODULE || "playwright",
);
const root = resolve("out");
const evidence = process.env.PONDERA_QA_OUTPUT || "/tmp/pondera-tax-qa";
await mkdir(evidence, { recursive: true });
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    ).replace(/^\/pondera-tax/, "");
    let file = resolve(root, "." + pathname);
    if (file !== root && !file.startsWith(root + sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    if ((await stat(file)).isDirectory()) file = resolve(file, "index.html");
    res.writeHead(200, {
      "Content-Type": mime[extname(file)] || "application/octet-stream",
    });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((resolve) => server.listen(4173, "127.0.0.1", resolve));
let browser;
let activePage;
try {
  let options = {
    headless: true,
    args: ["--single-process", "--no-zygote", "--disable-gpu"],
  };
  if (process.env.PONDERA_BROWSER_EXECUTABLE)
    options.executablePath = process.env.PONDERA_BROWSER_EXECUTABLE;
  if (process.env.PONDERA_CHROMIUM_MODULE) {
    const packed = (await import(process.env.PONDERA_CHROMIUM_MODULE)).default;
    options = {
      ...options,
      executablePath: await packed.executablePath(),
      args: packed.args,
    };
  }
  browser = await chromium.launch(options);
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  activePage = page;
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  await page.goto("http://127.0.0.1:4173/pondera-tax/#dashboard");
  await page.getByText("Salvo localmente", { exact: true }).waitFor();
  assert.equal(
    await page.locator(".bottom-nav,.step-strip,.subtabs").count(),
    0,
  );
  for (const label of [
    "Holerites",
    "Férias",
    "PLR e 13º salário",
    "Previdência",
    "Rendas extras",
    "Família",
    "Deduções legais",
    "Otimização",
    "Comparativo",
    "Fechamento anual",
    "Tabelas oficiais",
  ]) {
    await page
      .locator("aside")
      .getByRole("button", { name: label, exact: true })
      .click();
    await page.waitForTimeout(80);
    assert.ok(await page.locator("main").innerText(), label);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 2,
      ),
      `desktop overflow: ${label}`,
    );
  }
  await page
    .locator("aside")
    .getByRole("button", { name: "Holerites", exact: true })
    .click();
  await page
    .locator(".data-table tbody tr")
    .first()
    .getByRole("button")
    .click();
  const dialog = page.getByRole("dialog");
  assert.equal(
    await dialog.getByLabel("PGBL em folha", { exact: true }).count(),
    0,
  );
  const before = await dialog.locator(".result-ribbon").innerText();
  await dialog.getByLabel("Salário base", { exact: true }).fill("20000");
  assert.notEqual(
    await dialog.locator(".result-ribbon").innerText(),
    before,
    "live draft preview",
  );
  await dialog
    .getByLabel("Sobrescrever INSS do holerite", { exact: true })
    .check();
  await dialog
    .getByLabel("INSS do holerite informado", { exact: true })
    .fill("0");
  await dialog
    .getByLabel("Sobrescrever INSS do holerite", { exact: true })
    .uncheck();
  await dialog
    .getByLabel("Sobrescrever INSS do holerite", { exact: true })
    .check();
  assert.equal(
    await dialog
      .getByLabel("INSS do holerite informado", { exact: true })
      .inputValue(),
    "0",
  );
  await dialog
    .getByRole("button", { name: "Salvar competência", exact: true })
    .click();
  await page.getByText("Salvo localmente", { exact: true }).waitFor();
  await page.reload();
  await page
    .locator(".data-table tbody tr")
    .first()
    .getByRole("button")
    .click();
  assert.equal(
    await page
      .getByRole("dialog")
      .getByLabel("Salário base", { exact: true })
      .inputValue(),
    "20000",
  );
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await page
    .locator("aside")
    .getByRole("button", { name: "Previdência", exact: true })
    .click();
  await page
    .getByLabel("PGBL · % do salário base bruto", { exact: true })
    .fill("2");
  await page
    .getByLabel("Preencher automaticamente os 12 meses por percentual", {
      exact: true,
    })
    .check();
  assert.equal(
    await page.getByLabel("PGBL de Janeiro", { exact: true }).inputValue(),
    "400",
  );
  assert.ok(
    await page.getByLabel("PGBL de Janeiro", { exact: true }).isDisabled(),
  );
  await page
    .getByLabel("Preencher automaticamente os 12 meses por percentual", {
      exact: true,
    })
    .uncheck();
  assert.equal(
    await page.getByLabel("PGBL de Janeiro", { exact: true }).inputValue(),
    "400",
  );
  await page
    .locator("aside")
    .getByRole("button", { name: "Rendas extras", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Adicionar renda", exact: true })
    .first()
    .click();
  await page.getByLabel("Forma de lançamento").selectOption("annual");
  await page.getByLabel("Valor bruto", { exact: true }).fill("96000");
  assert.equal(
    await page.getByLabel("Mês do recebimento", { exact: true }).count(),
    0,
  );
  await page.getByRole("button", { name: "Salvar renda", exact: true }).click();
  await page
    .locator("aside")
    .getByRole("button", { name: "Fechamento anual", exact: true })
    .click();
  await page.screenshot({
    path: resolve(evidence, "desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const label of [
    "Holerites",
    "Férias",
    "PLR e 13º salário",
    "Previdência",
    "Rendas extras",
    "Família",
    "Deduções legais",
    "Otimização",
    "Comparativo",
    "Fechamento anual",
    "Tabelas oficiais",
  ]) {
    await page.getByRole("button", { name: "Abrir menu", exact: true }).click();
    await page
      .locator("aside")
      .getByRole("button", { name: label, exact: true })
      .click();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 2,
      ),
      `mobile overflow: ${label}`,
    );
  }
  await page.screenshot({
    path: resolve(evidence, "mobile.png"),
    fullPage: true,
  });
  for (const width of [320,390,768]) {
    await page.setViewportSize({width,height:844});
    assert.ok(await page.locator(".sticky-kpis strong").evaluateAll(nodes => nodes.every(n => n.scrollWidth <= n.clientWidth+1)), `KPI currency overflow at ${width}px`);
  }
  assert.equal(errors.length, 0, errors.join("\n"));
  console.log(
    JSON.stringify({
      status: "passed",
      routes: 11,
      viewports: [1440, 390],
      checks: [
        "navigation",
        "no duplicate nav",
        "live preview",
        "override zero",
        "reload persistence",
        "pension auto-fill",
        "annual extra income",
        "no page overflow",
        "no browser errors",
      ],
      evidence,
    }),
  );
} catch (error) {
  if (activePage) {
    await activePage.screenshot({
      path: resolve(evidence, "failure.png"),
      fullPage: true,
    });
    console.error((await activePage.locator("body").innerText()).slice(-6000));
  }
  throw error;
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
