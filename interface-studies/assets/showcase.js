import { canvasFit, adaptEmbeddedStudy } from "./showcase-embed.js";
import { SHOWCASE_SETTINGS, showcaseStudies, createShowcasePlayer } from "./showcase-model.js";
export function mountShowcase(section) {
  if (!section || section.dataset.showcaseMounted === "true") return () => {};
  section.dataset.showcaseMounted = "true";
  const abortController = new AbortController();
  let disposed = false;
  const listen = (target, type, handler, options = {}) =>
    target.addEventListener(type, handler, {
      ...(typeof options === "boolean" ? { capture: options } : options),
      signal: abortController.signal,
    });
  const $ = (id) => section.querySelector(`#${id}`),
    root = $("showcase-demo"),
    stage = $("showcase-stage");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)"),
    touchDevice = window.matchMedia("(hover: none)");
  const hoverArea = stage;
  const entries = showcaseStudies.map((study, index) => ({
    study,
    index,
    layer: null,
    frame: null,
    document: null,
    promise: null,
    ready: false,
    observer: null,
    engaged: false,
  }));
  let player,
    started = false,
    current = 0,
    keyboard = false,
    touchLocked = false,
    resizeRAF = 0,
    visibilityRAF = 0,
    focusTimer,
    loader,
    visibility;
  section.style.setProperty("--showcase-fade", `${SHOWCASE_SETTINGS.transitionMs}ms`);
  $("showcase-info").innerHTML = showcaseStudies
    .map(
      (s, i) =>
        `<div class="study-info ${i === 0 ? "is-current" : ""}" data-info="${i}" aria-hidden="${i !== 0}" ${i !== 0 ? "inert" : ""}><article class="study-info-panel"><p class="study-info-label">Try it</p><h3>${s.type}</h3><p class="study-info-description">${s.task}</p></article><article class="study-info-panel study-info-focus"><p class="study-info-label">The design decision</p><h3>${s.focus}</h3><p class="study-info-description">${s.reason}</p></article></div>`,
    )
    .join("");
  function updateHint() {
    $("showcase-hint").textContent =
      touchDevice.matches || touchLocked
        ? "Tap to pause and explore. Press Play to resume."
        : "Hover to pause and explore.";
  }
  function fit() {
    resizeRAF = 0;
    if (disposed) return;
    const bounds = stage.getBoundingClientRect(),
      width = bounds.width || stage.clientWidth,
      height = bounds.height || stage.clientHeight;
    if (!width || !height) return;
    checkVisibility();
    const geometry = canvasFit(width, height);
    for (const e of entries)
      if (e.frame) {
        e.frame.style.width = `${geometry.width}px`;
        e.frame.style.height = `${geometry.height}px`;
        e.frame.style.left = `${geometry.left}px`;
        e.frame.style.top = `${geometry.top}px`;
        e.frame.style.transform = `scale(${geometry.scale})`;
      }
  }
  function scheduleFit() {
    if (disposed) return;
    if (!resizeRAF) resizeRAF = requestAnimationFrame(fit);
  }
  const resizeObserver = new ResizeObserver(scheduleFit);
  resizeObserver.observe(stage);
  function frameAccessible(e, active) {
    e.layer?.setAttribute("aria-hidden", String(!active));
    if (e.layer) e.layer.inert = !active;
    if (e.frame) {
      e.frame.tabIndex = active ? 0 : -1;
      e.frame.setAttribute("aria-hidden", String(!active));
      e.frame.inert = !active;
    }
    if (e.document) {
      e.document.documentElement.inert = !active;
      for (const dialog of e.document.querySelectorAll("dialog")) dialog.inert = !active;
    }
  }
  function settle(index) {
    root.classList.add("is-settled");
    for (const e of entries) e.layer?.classList.remove("is-leaving");
    for (const el of $("showcase-info").children) el.classList.remove("is-leaving");
  }
  function show(index, previous, { animate }) {
    current = index;
    root.classList.toggle("is-settled", !animate);
    for (const e of entries) {
      if (!e.layer) continue;
      e.layer.classList.toggle("is-current", e.index === index);
      e.layer.classList.toggle("is-leaving", animate && e.index === previous);
      e.layer.classList.remove("is-preparing");
      frameAccessible(e, e.index === index);
    }
    for (const el of $("showcase-info").children) {
      const active = +el.dataset.info === index;
      el.classList.toggle("is-current", active);
      el.classList.toggle("is-leaving", animate && +el.dataset.info === previous);
      el.setAttribute("aria-hidden", String(!active));
      el.inert = !active;
    }
    const study = showcaseStudies[index];
    $("showcase-name").textContent = study.name;
    $("showcase-counter").textContent =
      `${String(index + 1).padStart(2, "0")} / ${String(entries.length).padStart(2, "0")}`;
    $("showcase-loading").hidden = true;
    stage.setAttribute("aria-busy", "false");
    $("showcase-error").hidden = true;
    $("showcase-announcement").textContent =
      `${study.name}, ${study.type}, ${index + 1} of ${entries.length}`;
    syncFocus();
    syncModal();
  }
  function changed(s) {
    $("showcase-previous").disabled = !s.hasFrame;
    $("showcase-next").disabled = !s.hasFrame;
    $("showcase-toggle").disabled = !s.hasFrame || s.reduced;
    // During a temporary pause the control still offers Play, so explicit touch resume is always clear.
    const paused = !s.wantsPlay || s.blocked.includes("touch");
    $("showcase-toggle-label").textContent = s.reduced ? "Manual" : paused ? "Play" : "Pause";
    $("showcase-toggle").setAttribute(
      "aria-label",
      s.reduced
        ? "Automatic preview disabled for reduced motion"
        : paused
          ? "Play automatic preview"
          : "Pause automatic preview",
    );
    $("showcase-toggle").title = s.reduced
      ? "Reduced motion: use Previous and Next"
      : paused
        ? "Play"
        : "Pause";
    const status = $("showcase-status");
    let text;
    if (!s.hasFrame)
      text = s.waiting
        ? "Loading previews"
        : started
          ? "Preview unavailable"
          : "Preview starts when in view";
    else if (s.reduced) text = "Manual mode · reduced motion";
    else if (s.waiting) text = "Loading the next demo";
    else if (!s.wantsPlay || s.blocked.includes("touch")) text = "Paused · press Play to resume";
    else if (s.blocked.includes("hidden")) text = "Paused · tab is inactive";
    else if (s.blocked.includes("offscreen")) text = "Paused · outside the viewing area";
    else if (s.blocked.includes("focus") || s.blocked.includes("modal"))
      text = "Paused while you interact";
    else if (s.blocked.includes("hover")) text = "Paused · move outside the preview to resume";
    else
      text = `Auto-play · ${SHOWCASE_SETTINGS.intervalMs / 1000} ${SHOWCASE_SETTINGS.intervalMs === 1000 ? "second" : "seconds"} per study`;
    status.textContent = text;
    status.dataset.playing = String(s.playing || s.transitioning);
    $("showcase-announcement").setAttribute(
      "aria-live",
      s.wantsPlay && !s.reduced ? "off" : "polite",
    );
  }
  function fail(index) {
    const s = showcaseStudies[index];
    stage.setAttribute("aria-busy", "false");
    if (!player.snapshot().hasFrame) {
      $("showcase-loading").innerHTML =
        `<strong>The preview couldn’t load.</strong><p>You can open the study directly or try again.</p><button type="button" id="showcase-retry" class="showcase-retry">Retry preview</button><a href="/interface-studies/studies/${s.slug}/index.html" target="_blank" rel="noopener">Open ${s.name} full demo ↗</a>`;
      $("showcase-loading").hidden = false;
      listen($("showcase-retry"), "click", () => player.select(index));
    } else {
      $("showcase-error").innerHTML =
        `${s.name} couldn’t load. The current demo is still open. <button id="showcase-error-retry" type="button">Try again</button>`;
      $("showcase-error").hidden = false;
      listen($("showcase-error-retry"), "click", () => player.select(index));
    }
  }
  function lockTouch(e) {
    if (e.pointerType !== "touch" && e.type !== "touchstart") return;
    touchLocked = true;
    keyboard = false;
    updateHint();
    player.setBlock("touch", true);
    player.pause();
    syncFocus();
  }
  function syncFocus() {
    const active = document.activeElement;
    let holds = false;
    if (root.contains(active)) {
      const entry = entries.find((e) => e.frame === active);
      if (entry && entry.index === current) {
        const child = entry.document?.activeElement;
        holds =
          keyboard ||
          !!(
            entry.engaged &&
            child &&
            child !== entry.document.body &&
            child !== entry.document.documentElement
          );
      } else if (!entry) holds = keyboard;
    }
    player?.setBlock("focus", holds);
  }
  function laterFocus() {
    clearTimeout(focusTimer);
    focusTimer = setTimeout(syncFocus, 0);
  }
  function visible(element) {
    if (
      element.hidden ||
      element.closest("[hidden]") ||
      (element.tagName === "DIALOG" && !element.hasAttribute("open"))
    )
      return false;
    return !!(
      element.getClientRects().length &&
      element.ownerDocument.defaultView.getComputedStyle(element).visibility !== "hidden"
    );
  }
  function syncModal() {
    const entry = entries[current],
      doc = entry.document;
    const candidates = doc
      ? [...doc.querySelectorAll('dialog[open],[role="dialog"][aria-modal="true"],details[open]')]
      : [];
    if (entry.engaged && doc) candidates.push(...doc.querySelectorAll('[aria-expanded="true"]'));
    const open = candidates.some(
      (el) => !(el.getAttribute("aria-controls") === "token-editor") && visible(el),
    );
    player?.setBlock("modal", open);
  }
  function bridge(entry) {
    const doc = entry.document;
    const active = (fn) => (event) => {
      if (entry.index === current) fn(event);
    };
    listen(
      doc,
      "pointerdown",
      active((e) => {
        entry.engaged = true;
        keyboard = false;
        lockTouch(e);
        laterFocus();
      }),
      true,
    );
    listen(
      doc,
      "touchstart",
      active((e) => {
        entry.engaged = true;
        lockTouch(e);
      }),
      { passive: true, capture: true },
    );
    listen(
      doc,
      "keydown",
      active(() => {
        entry.engaged = true;
        keyboard = true;
        syncFocus();
      }),
      true,
    );
    listen(doc, "focusin", active(syncFocus), true);
    listen(doc, "focusout", active(laterFocus), true);
    listen(
      doc,
      "input",
      active(() => {
        entry.engaged = true;
        syncFocus();
      }),
      true,
    );
    listen(doc, "change", active(syncFocus), true);
    // A brand/source link may open another page; do not replace a persistent prototype iframe.
    listen(
      doc,
      "click",
      active((event) => {
        const anchor = event.target.closest?.("a[href]");
        if (!anchor) return;
        const frameURL = new URL(entry.frame.src, location.origin),
          url = new URL(anchor.getAttribute("href"), frameURL);
        if (
          url.protocol.startsWith("http") &&
          (url.pathname !== frameURL.pathname || url.origin !== location.origin) &&
          !anchor.getAttribute("href").startsWith("#")
        ) {
          anchor.target = "_blank";
          anchor.rel = "noopener";
        }
      }),
      true,
    );
    entry.observer = new MutationObserver(() => {
      if (entry.index === current) syncModal();
    });
    entry.observer.observe(doc.documentElement, {
      subtree: true,
      attributes: true,
      attributeFilter: ["open", "hidden", "aria-expanded", "aria-hidden", "style", "class"],
      childList: true,
    });
    listen(
      doc,
      "wheel",
      active((event) => {
        const target = event.target.closest?.('dialog[open],[role="dialog"][aria-modal="true"]');
        if (target && target.scrollHeight > target.clientHeight + 1) return;
        event.preventDefault();
        window.scrollBy({ top: event.deltaY, left: 0, behavior: "instant" });
      }),
      { passive: false },
    );
    listen(entry.frame.contentWindow, "blur", active(laterFocus));
  }
  async function contentReady(entry, frame) {
    if (disposed) throw Error("Showcase unmounted");
    const doc = frame.contentDocument;
    if (!doc || !doc.body || !doc.querySelector('script[type="module"]'))
      throw Error("Study unavailable");
    entry.document = doc;
    adaptEmbeddedStudy(doc, entry.study.slug);
    frameAccessible(entry, false);
    bridge(entry);
    fit();
    if (doc.fonts?.ready) await doc.fonts.ready;
    // Only images in the first viewport are prerequisites. Long pages load below-fold images normally.
    const height = frame.clientHeight;
    await Promise.all(
      [...doc.images]
        .filter((img) => {
          const r = img.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && r.top < height && r.bottom > 0;
        })
        .map((img) => {
          img.loading = "eager";
          if (img.decode) return img.decode().catch(() => {});
          return Promise.resolve();
        }),
    );
    if (!document.hidden)
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (disposed || entry.frame !== frame || entry.document !== doc || !frame.isConnected)
      throw Error("Preview preparation expired");
    entry.ready = true;
  }
  function prepare(index) {
    if (disposed) return Promise.reject(Error("Showcase unmounted"));
    const entry = entries[index];
    if (entry.ready) return Promise.resolve();
    if (entry.promise) return entry.promise;
    const layer = document.createElement("div");
    layer.className = "showcase-slide is-preparing";
    layer.dataset.study = entry.study.slug;
    layer.setAttribute("role", "group");
    layer.setAttribute("aria-roledescription", "slide");
    layer.setAttribute("aria-label", `${index + 1} of ${entries.length}: ${entry.study.name}`);
    layer.setAttribute("aria-hidden", "true");
    layer.inert = true;
    const frame = document.createElement("iframe");
    frame.title = `${entry.study.name} — interactive ${entry.study.type.toLowerCase()}`;
    frame.loading = "eager";
    frame.tabIndex = -1;
    frame.inert = true;
    frame.setAttribute("aria-hidden", "true");
    entry.layer = layer;
    entry.frame = frame;
    entry.promise = new Promise((resolve, reject) => {
      let done = false;
      const timeout = setTimeout(() => finish(Error("Preview timed out")), 25000);
      function finish(error) {
        if (done) return;
        done = true;
        entry.cancelLoad = null;
        clearTimeout(timeout);
        if (error) {
          entry.observer?.disconnect();
          layer.remove();
          entry.layer = null;
          entry.frame = null;
          entry.document = null;
          entry.ready = false;
          entry.promise = null;
          reject(error);
        } else {
          layer.classList.remove("is-preparing");
          resolve();
        }
      }
      entry.cancelLoad = () => finish(Error("Showcase unmounted"));
      listen(
        frame,
        "load",
        () => {
          contentReady(entry, frame)
            .then(() => finish())
            .catch(finish);
        },
        { once: true },
      );
      listen(frame, "error", () => finish(Error("Preview unavailable")), { once: true });
      frame.src = `/interface-studies/studies/${entry.study.slug}/index.html?preview=1&showcase=1`;
      layer.append(frame);
      stage.append(layer);
      fit();
    });
    return entry.promise;
  }
  player = createShowcasePlayer({
    count: entries.length,
    prepare,
    display: show,
    settle,
    changed,
    failed: fail,
  });
  function begin() {
    if (disposed || started) return;
    started = true;
    void player.start().then(() => {
      if (disposed) return; // Warm the next study first, then the rest, while retaining all loaded documents.
      for (let i = 1; i < entries.length; i++) void prepare(i).catch(() => {});
    });
  }
  function updateVisibility(isVisible) {
    player.setBlock("offscreen", !isVisible);
    if (isVisible) begin();
  }
  // Read the current viewport after resize/scroll instead of trusting a queued intersection entry.
  function checkVisibility() {
    visibilityRAF = 0;
    if (disposed || !player) return;
    const r = stage.getBoundingClientRect();
    const width = Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0));
    const height = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
    updateVisibility(
      r.width > 0 && r.height > 0 && (width * height) / (r.width * r.height) >= 0.15,
    );
  }
  function scheduleVisibility() {
    if (!disposed && !visibilityRAF) visibilityRAF = requestAnimationFrame(checkVisibility);
  }
  listen(window, "scroll", scheduleVisibility, { passive: true });
  listen(window, "resize", scheduleVisibility);
  if ("IntersectionObserver" in window) {
    loader = new IntersectionObserver(
      (items) => {
        if (items.some((e) => e.isIntersecting)) {
          begin();
          loader.disconnect();
        }
      },
      { rootMargin: "900px 0px" },
    );
    loader.observe(section);
    visibility = new IntersectionObserver(checkVisibility, { threshold: [0, 0.15] });
    visibility.observe(stage);
  }
  listen(hoverArea, "pointerenter", (e) => {
    if (e.pointerType === "touch") return;
    player.setBlock("hover", true);
  });
  listen(hoverArea, "pointerleave", (e) => {
    if (e.pointerType === "touch") return;
    player.setBlock("hover", false);
    laterFocus();
  });
  listen(
    root,
    "pointerdown",
    (e) => {
      keyboard = false;
      lockTouch(e);
      laterFocus();
    },
    true,
  );
  listen(root, "touchstart", lockTouch, { passive: true, capture: true });
  listen(
    document,
    "keydown",
    () => {
      keyboard = true;
      syncFocus();
    },
    true,
  );
  listen(
    document,
    "pointerdown",
    () => {
      keyboard = false;
      laterFocus();
    },
    true,
  );
  listen(document, "focusin", syncFocus, true);
  listen(document, "focusout", laterFocus, true);
  listen(window, "blur", laterFocus);
  listen($("showcase-previous"), "click", () => {
    void player.previous();
  });
  listen($("showcase-next"), "click", () => {
    void player.next();
  });
  listen($("showcase-toggle"), "click", () => {
    const s = player.snapshot();
    if (!s.wantsPlay || touchLocked) {
      touchLocked = false;
      updateHint();
      player.setBlock("touch", false);
      syncFocus();
      player.play();
    } else player.pause();
  });
  listen(document, "visibilitychange", () => player.setBlock("hidden", document.hidden));
  listen(reduce, "change", (e) => player.setReduced(e.matches));
  listen(touchDevice, "change", updateHint);
  player.setReduced(reduce.matches);
  player.setBlock("hidden", document.hidden);
  updateHint();
  fit();

  return () => {
    if (disposed) return;
    disposed = true;
    player.destroy();
    abortController.abort();
    loader?.disconnect();
    visibility?.disconnect();
    resizeObserver.disconnect();
    if (resizeRAF) cancelAnimationFrame(resizeRAF);
    if (visibilityRAF) cancelAnimationFrame(visibilityRAF);
    clearTimeout(focusTimer);
    for (const entry of entries) {
      entry.cancelLoad?.();
      entry.observer?.disconnect();
      entry.layer?.remove();
      entry.layer = null;
      entry.frame = null;
      entry.document = null;
    }
    root.classList.remove("is-settled");
    stage.setAttribute("aria-busy", "true");
    $("showcase-info").replaceChildren();
    delete section.dataset.showcaseMounted;
  };
}
