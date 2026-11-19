/** Read the rendered document, including same-origin plugin and mockup frames. No application state is changed. */
export function inspectIcons() {
  const problems = [];
  let svg = 0, images = 0, status = 0;
  const visible = (el) => {
    const box = el.getBoundingClientRect();
    const style = el.ownerDocument.defaultView.getComputedStyle(el);
    return box.width > 0 && box.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  };
  const visit = (doc, context) => {
    for (const el of doc.querySelectorAll("svg")) {
      if (!visible(el)) continue;
      svg++;
      if (!el.querySelector("path,rect,circle,line,polyline,polygon,ellipse,text,image,use,foreignObject")) problems.push(`${context}: empty SVG ${el.outerHTML.slice(0,160)}`);
    }
    for (const el of doc.querySelectorAll("img")) {
      if (!visible(el)) continue;
      images++;
      if (el.complete && !el.naturalWidth) problems.push(`${context}: broken image ${el.getAttribute("src")?.slice(0,120)}`);
    }
    // The SVG's inset circle needs a white gap and a separate outer contour, including initials on cards.
    for (const el of doc.querySelectorAll(".mx-status-disk")) {
      if (!visible(el)) continue;
      const style = doc.defaultView.getComputedStyle(el);
      const circle = el.querySelector("svg circle");
      if (+style.borderTopWidth.replace("px", "") < 1 || style.borderTopStyle === "none" || style.backgroundColor !== "rgb(255, 255, 255)" || !circle || +circle.getAttribute("r") >= 12) {
        problems.push(`${context}: disk lost its outer contour or white separation`);
      }
    }
    // A change filter is not a plain colour key: every row, including an absent one, must keep its sign.
    const signs = { Added: "+", Changed: "~", Removed: "−", Unchanged: "=" };
    for (const row of doc.querySelectorAll('[role="checkbox"],.row,.frow,.mx-filter-row')) {
      const label = row.textContent.trim().replace(/^[+~−=]\s*/, "");
      if (!signs[label] || !visible(row) || !/Added|Changed|Unchanged/.test(row.parentElement?.textContent ?? "")) continue;
      status++;
      const icon = row.querySelector("svg[data-sign]");
      const uri = row.querySelector("img,image");
      const source = uri?.getAttribute("src") ?? uri?.getAttribute("href") ?? "";
      const encoded = { Added: "%2B", Changed: "~", Removed: "%E2%88%92", Unchanged: "%3D" };
      if (icon?.getAttribute("data-sign") !== signs[label] && !source.includes(`data-sign%3D%22${encoded[label]}%22`)) problems.push(`${context}: ${label} has no production status sign`);
    }

  };
  visit(document, "page");
  return { svg, images, status, problems };
}

export async function auditIconFrames(scope) {
  const result = await scope.locator("body").evaluate(inspectIcons);
  const frames = await scope.locator("iframe").evaluateAll((elements) => elements.map((frame) => {
    const parts = [];
    for (let el = frame; el && el.tagName !== "BODY"; el = el.parentElement) {
      let index = 1;
      for (let prev = el.previousElementSibling; prev; prev = prev.previousElementSibling) index++;
      parts.unshift(`${el.tagName.toLowerCase()}:nth-child(${index})`);
    }
    return `body > ${parts.join(" > ")}`;
  }));
  result.documents = 1;
  for (const selector of frames) {
    const nested = await auditIconFrames(scope.frameLocator(selector));
    for (const key of ["svg", "images", "status", "documents"]) result[key] += nested[key];
    result.problems.push(...nested.problems);
  }
  return result;
}

export async function assertIcons(scope) {
  const result = await auditIconFrames(scope);
  if (result.problems.length) throw new Error(result.problems.join("\n"));
  return result;
}
