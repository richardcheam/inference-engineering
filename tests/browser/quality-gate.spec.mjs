import { test, expect } from '@playwright/test';

/**
 * The Phase 8 quality gate, as a suite.
 *
 * Every assertion corresponds to a rule of the design system, recorded in
 * `docs/superpowers/specs/2026-09-16-design-system.md`. Each was verified by
 * hand once; encoding them means a later change cannot quietly undo one.
 *
 * Section numbers in the comments below refer to the design briefs these rules
 * came from. Those briefs are development material and are not part of this
 * repository; the spec above carries what they decided.
 */

const ROUTES = [
  '#home', '#feasibility', '#hardware', '#reuse', '#engine', '#measure',
  '#profile', '#parallel', '#quantize', '#speculate', '#production',
  '#sources', '#library', '#roadmap', '#radar', '#equations',
  '#hardware-reference', '#bookmarks',
];

/** The viewports Phase 7 names, narrowest to widest. */
const VIEWPORTS = [
  { w: 375, h: 812 }, { w: 430, h: 932 }, { w: 768, h: 1024 },
  { w: 1024, h: 768 }, { w: 1280, h: 800 }, { w: 1440, h: 900 },
  { w: 1512, h: 982 }, { w: 1728, h: 1117 }, { w: 1920, h: 1080 },
  { w: 2560, h: 1440 }, { w: 3440, h: 1440 },
];

/** Navigating by hash alone does not reload, so give the router a beat. */
async function goTo(page, route) {
  await page.evaluate(r => { window.location.hash = r; }, route);
  await page.waitForTimeout(160);
}

test.describe('no horizontal overflow', () => {
  for (const { w, h } of VIEWPORTS) {
    test(`${w}x${h}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto('/#home');
      await page.waitForSelector('.home-hero');
      for (const route of ROUTES) {
        await goTo(page, route);
        const excess = await page.evaluate(() => {
          const de = document.documentElement;
          return de.scrollWidth - de.clientWidth;
        });
        expect(excess, `${route} at ${w}px overflows by ${excess}px`).toBeLessThanOrEqual(0);
      }
    });
  }
});

test.describe('composition', () => {
  test('reading width grows with the workspace and stays bounded', async ({ page }) => {
    // Measured against this font's real advance, not an assumed 0.5em: Inter
    // at 18px averages 0.471em, so a fixed divisor would misreport by ~6%.
    const widths = [];
    for (const { w, h } of VIEWPORTS) {
      await page.setViewportSize({ width: w, height: h });
      await page.goto('/#engine');
      await page.waitForSelector('.section-body > p');
      const m = await page.evaluate(() => {
        const p = document.querySelector('.section-body > p');
        const cs = getComputedStyle(p);
        const c = document.createElement('canvas').getContext('2d');
        c.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        const advance = c.measureText(p.innerText).width / p.innerText.length;
        return {
          px: p.getBoundingClientRect().width,
          chars: Math.round(p.getBoundingClientRect().width / advance),
          track: document.querySelector('.article').getBoundingClientRect().width,
        };
      });
      widths.push({ w, ...m });

      // Bounded by the track's own 74rem ceiling rather than by a character
       // count: inside the article, reading content takes the content track so
       // that its edges line up with the artifact it describes.
      expect(m.chars, `${m.chars} characters at ${w}px`).toBeLessThanOrEqual(145);
      // Never wider than the track it sits in.
      expect(m.px, `prose ${Math.round(m.px)}px in a ${Math.round(m.track)}px track at ${w}px`)
        .toBeLessThanOrEqual(m.track + 1);
      // The defect this replaced: 640px of prose beside 504px of dead track.
      if (w >= 1280) {
        expect(m.px, `prose only ${Math.round(m.px)}px at ${w}px`).toBeGreaterThanOrEqual(700);
      }
    }
    // Monotonic: more workspace never yields a narrower measure.
    for (let i = 1; i < widths.length; i++) {
      expect(widths[i].px, `prose shrank from ${widths[i - 1].w}px to ${widths[i].w}px`)
        .toBeGreaterThanOrEqual(widths[i - 1].px - 1);
    }
  });

  test('technical artifacts are never narrower than the prose', async ({ page }) => {
    for (const w of [1280, 1440, 1728, 1920, 2560, 3440]) {
      await page.setViewportSize({ width: w, height: 1000 });
      await page.goto('/#engine');
      await page.waitForSelector('.explorer');
      const m = await page.evaluate(() => {
        const px = s => { const e = document.querySelector(s); return e ? e.getBoundingClientRect().width : null; };
        return { reading: px('.section-body > p'), equation: px('.math-block'), figure: px('.explorer') };
      });
      expect(m.figure, `figure ${Math.round(m.figure)} vs prose ${Math.round(m.reading)} at ${w}px`)
        .toBeGreaterThanOrEqual(m.reading - 1);
      if (m.equation) {
        expect(m.equation, `equation ${Math.round(m.equation)} vs prose ${Math.round(m.reading)} at ${w}px`)
          .toBeGreaterThanOrEqual(m.reading - 1);
      }
    }
  });

  test('prose ends where the figure it describes ends', async ({ page }) => {
    // The correction that prompted this: a paragraph stopping 96px (1440) to
    // 329px (1920) short of the artifact directly beneath it read as two
    // unrelated columns.
    for (const w of [1280, 1440, 1512, 1728, 1920, 2560, 3440]) {
      await page.setViewportSize({ width: w, height: 1000 });
      await page.goto('/#feasibility');
      await page.waitForSelector('.decode-walkthrough');
      const m = await page.evaluate(() => {
        const right = s => Math.round(document.querySelector(s).getBoundingClientRect().right);
        return {
          prose: right('.section-body > p'),
          figure: right('.decode-walkthrough'),
          rule: right('.section-label'),
          callout: document.querySelector('.key-idea') ? right('.key-idea') : null,
        };
      });
      expect(m.prose, `prose ends ${m.figure - m.prose}px short of the figure at ${w}px`).toBe(m.figure);
      expect(m.rule, `section rule misaligned at ${w}px`).toBe(m.figure);
      if (m.callout !== null) expect(m.callout, `callout misaligned at ${w}px`).toBe(m.figure);
    }
  });

  test('callouts share the reading measure, not a narrower one of their own', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/#engine');
    await page.waitForSelector('.key-idea');
    const m = await page.evaluate(() => {
      const px = s => { const e = document.querySelector(s); return e ? Math.round(e.getBoundingClientRect().width) : null; };
      const indent = () => {
        const t = document.querySelector('.takeaway'), a = document.querySelector('.article');
        return t ? Math.round(t.getBoundingClientRect().left - a.getBoundingClientRect().left) : 0;
      };
      return { prose: px('.section-body > p'), callout: px('.key-idea'),
               takeaway: px('.takeaway'), takeawayIndent: indent() };
    });
    expect(m.callout, `callout ${m.callout} vs prose ${m.prose}`).toBe(m.prose);
    // The takeaway is the exception, and deliberately so: module 14 §30 asks
    // for the conclusion to be set apart rather than run to the same edge as
    // the argument, so on a wide track it is narrower and steps in.
    if (m.takeaway) {
      expect(m.takeaway, `takeaway ${m.takeaway} vs prose ${m.prose}`).toBeLessThan(m.prose);
      expect(m.takeawayIndent, 'the conclusion is not set apart').toBeGreaterThan(100);
    }
  });

  test('the hero and the body share a column edge below the split', async ({ page }) => {
    for (const w of [1280, 1440, 1512]) {
      await page.setViewportSize({ width: w, height: 1000 });
      await page.goto('/#engine');
      await page.waitForSelector('.article h1');
      const m = await page.evaluate(() => {
        const b = s => { const e = document.querySelector(s); const r = e.getBoundingClientRect(); return { w: Math.round(r.width), l: Math.round(r.left) }; };
        return { h1: b('.article h1'), prose: b('.section-body > p') };
      });
      expect(m.h1.l, `left edges differ at ${w}px`).toBe(m.prose.l);
      expect(m.h1.w, `hero ${m.h1.w} vs body ${m.prose.w} at ${w}px`).toBe(m.prose.w);
    }
  });

  test('the table of contents stays beside the article, never adrift', async ({ page }) => {
    // The original defect: a 1288px void between article and rail at 2560px.
    for (const w of [1280, 1440, 1920, 2560, 3440]) {
      await page.setViewportSize({ width: w, height: 1000 });
      await page.goto('/#hardware');
      await page.waitForSelector('.page-rail');
      const gap = await page.evaluate(() => {
        const article = document.querySelector('.article');
        const rail = document.querySelector('.page-rail');
        return Math.round(rail.getBoundingClientRect().left - article.getBoundingClientRect().right);
      });
      expect(gap, `gap of ${gap}px at ${w}px`).toBeGreaterThan(0);
      expect(gap, `gap of ${gap}px at ${w}px`).toBeLessThan(200);
    }
  });

  test('tables take the wide track on a large screen', async ({ page }) => {
    await page.setViewportSize({ width: 2560, height: 1440 });
    await page.goto('/#sources');
    await page.waitForSelector('table');
    const width = await page.evaluate(() => Math.round(document.querySelector('table').getBoundingClientRect().width));
    expect(width).toBeGreaterThan(1000);
  });

  test('the rail collapses to a drawer when there is no room for it', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto('/#hardware');
    await expect(page.locator('.page-rail')).toBeHidden();
    await expect(page.locator('.toc-drawer, .toc-fab')).not.toHaveCount(0);
  });
});

test.describe('typography', () => {
  test('no em dashes reach the reader', async ({ page }) => {
    await page.goto('/#home');
    await page.waitForSelector('.home-hero');
    for (const route of ROUTES) {
      await goTo(page, route);
      await page.waitForTimeout(140);
      const count = await page.evaluate(() => (document.body.innerText.match(/—/g) || []).length);
      expect(count, `${route} renders ${count} em dashes`).toBe(0);
    }
  });

  test('micro-labels stay within the tracking ceiling', async ({ page }) => {
    // 03_layout_typography_color §7: labels take 0.04em–0.1em.
    await page.goto('/#hardware');
    await page.waitForSelector('.kicker');
    const tracking = await page.evaluate(() => {
      const out = [];
      for (const sel of ['.kicker', '.eyebrow', '.section-label', '.figure-id']) {
        const el = document.querySelector(sel);
        if (!el) continue;
        const cs = getComputedStyle(el);
        out.push({ sel, em: parseFloat(cs.letterSpacing) / parseFloat(cs.fontSize) });
      }
      return out;
    });
    expect(tracking.length).toBeGreaterThan(0);
    for (const { sel, em } of tracking) {
      expect(em, `${sel} tracks at ${em.toFixed(3)}em`).toBeLessThanOrEqual(0.1);
    }
  });
});

test.describe('figures', () => {
  test('every figure carries an identifier, unique across the guide', async ({ page }) => {
    await page.goto('/#feasibility');
    await page.waitForSelector('.figure-id');
    const seen = [];
    for (const route of ['#feasibility', '#hardware', '#reuse', '#engine', '#measure',
                         '#profile', '#parallel', '#quantize', '#speculate']) {
      await goTo(page, route);
      await page.waitForTimeout(200);
      const ids = await page.evaluate(() => [...document.querySelectorAll('.figure-id')].map(e => e.textContent.trim()));
      expect(ids.length, `${route} shows no figure identifier`).toBeGreaterThan(0);
      seen.push(...ids);
    }
    expect(new Set(seen).size, 'figure numbers repeat').toBe(seen.length);
  });
});

test.describe('mobile', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('controls are large enough to hit', async ({ page }) => {
    await page.goto('/#feasibility');
    await page.waitForSelector('input[type=range]');
    const small = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('.explorer button, input[type=range], select')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.height < 32) out.push(((typeof el.className === 'string' ? el.className : '') || el.tagName) + ` ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
      return out;
    });
    expect(small, `undersized controls: ${small.join(', ')}`).toEqual([]);
  });

  test('the title keeps its presence', async ({ page }) => {
    // 09 Gate 8: the hero must not shrink to nothing on a phone.
    await page.goto('/#hardware');
    const size = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.article h1')).fontSize));
    expect(size).toBeGreaterThan(32);
  });
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('content is all present and still', async ({ page }) => {
    await page.goto('/#feasibility');
    await page.waitForSelector('.decode-walkthrough');
    // Nothing essential may be hidden behind an entrance animation.
    const hidden = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('.lesson-section, .explorer, .key-idea')) {
        if (parseFloat(getComputedStyle(el).opacity) < 0.99) out.push(el.className);
      }
      return out;
    });
    expect(hidden, `elements left transparent: ${hidden.join(', ')}`).toEqual([]);
  });
});

test.describe('scroll scene', () => {
  const sceneUrl = '/#engine';

  test('the stage stays pinned while the explanation advances, and releases at the end', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(sceneUrl);
    await page.waitForSelector('.scene-sticky');
    const stickTop = await page.evaluate(() =>
      parseFloat(getComputedStyle(document.querySelector('.scene-sticky')).top));

    const samples = await page.evaluate(async top => {
      const grid = document.querySelector('.scene-grid');
      const sticky = document.querySelector('.scene-sticky');
      const start = window.scrollY + grid.getBoundingClientRect().top;
      const height = grid.getBoundingClientRect().height;
      const seen = [];
      for (let i = 0; i <= 14; i++) {
        window.scrollTo(0, start - 200 + (height + 400) * i / 14);
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        const g = grid.getBoundingClientRect();
        // Sticky is in force only while the grid still has room below the stick
        // line for the whole stage; past that it releases with the grid, which
        // is correct behaviour rather than drift.
        const stageHeight = sticky.getBoundingClientRect().height;
        if (g.top < top && g.bottom - stageHeight > top) {
          seen.push(Math.round(sticky.getBoundingClientRect().top));
        }
      }
      return seen;
    }, stickTop);

    expect(samples.length, 'the scene never spanned the viewport').toBeGreaterThan(4);
    for (const top of samples) {
      expect(Math.abs(top - stickTop), `stage drifted to ${top}, expected ${stickTop}`).toBeLessThanOrEqual(2);
    }
  });

  test('scrolling back up replays the states in reverse', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(sceneUrl);
    await page.waitForSelector('.scene-captions > li');
    const active = () => page.evaluate(() => {
      const el = document.querySelector('.scene-captions > li.active');
      return el ? Number(el.dataset.index) : null;
    });
    const step = async i => {
      await page.evaluate(idx => document.querySelectorAll('.scene-captions > li')[idx]
        .scrollIntoView({ block: 'center', behavior: 'instant' }), i);
      await page.waitForTimeout(200);
      return active();
    };
    const forward = [];
    for (let i = 0; i < 6; i++) forward.push(await step(i));
    const back = [];
    for (let i = 5; i >= 0; i--) back.push(await step(i));
    expect(forward, 'forward scroll did not track the captions').toEqual([0, 1, 2, 3, 4, 5]);
    expect(back, 'reverse scroll did not track the captions').toEqual([5, 4, 3, 2, 1, 0]);
  });

  test('the stage shows which request owns which block', async ({ page }) => {
    // The bug this caught: `.ds .pool-block` outranked `.owner-N`, so every
    // claimed block rendered in the neutral surface colour.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(sceneUrl);
    await page.waitForSelector('.scheduler-stage');
    await page.evaluate(() => document.querySelectorAll('.scene-captions > li')[3]
      .scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.waitForTimeout(250);
    const colours = await page.evaluate(() => {
      const stage = document.querySelector('.scheduler-stage');
      const surface = getComputedStyle(document.body).getPropertyValue('--surface').trim();
      return {
        blocks: [...stage.querySelectorAll('.pool-block.used')]
          .map(b => getComputedStyle(b).backgroundColor),
        fills: [...stage.querySelectorAll('.lane-fill')]
          .map(f => ({ w: f.getBoundingClientRect().width, bg: getComputedStyle(f).backgroundColor })),
        surface,
      };
    });
    expect(colours.blocks.length, 'no blocks are claimed in this state').toBeGreaterThan(0);
    expect(new Set(colours.blocks).size, 'every claimed block is the same colour').toBeGreaterThan(1);
    const advancing = colours.fills.filter(f => f.w > 0);
    expect(advancing.length, 'no request shows progress').toBeGreaterThan(0);
    for (const f of advancing) {
      expect(f.bg, 'a progress bar has no colour').not.toBe('rgba(0, 0, 0, 0)');
    }
  });

  test('a narrow viewport gets the stacked storyboard, with every caption intact', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(sceneUrl);
    await page.waitForSelector('.scroll-scene');
    const m = await page.evaluate(() => ({
      stacked: document.querySelector('.scroll-scene').classList.contains('stacked'),
      stages: document.querySelectorAll('.scene-storyboard > li').length,
      sticky: !!document.querySelector('.scene-sticky'),
      shortCaptions: [...document.querySelectorAll('.scene-caption')].filter(p => p.innerText.length < 40).length,
    }));
    expect(m.stacked).toBe(true);
    expect(m.stages).toBe(6);
    expect(m.sticky, 'a phone should not get a sticky stage').toBe(false);
    expect(m.shortCaptions, 'a caption lost its text in the fallback').toBe(0);
  });
});

test.describe('scroll scene under reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('falls back to the static storyboard and keeps all six states', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/#engine');
    await page.waitForSelector('.scroll-scene');
    const m = await page.evaluate(() => ({
      stacked: document.querySelector('.scroll-scene').classList.contains('stacked'),
      stages: document.querySelectorAll('.scene-storyboard > li').length,
      transitions: [...document.querySelectorAll('.scene-caption, .pool-block, .lane-fill')]
        .map(el => getComputedStyle(el).transitionDuration)
        .filter(d => d !== '0s').length,
      faded: [...document.querySelectorAll('.scene-storyboard > li')]
        .filter(el => parseFloat(getComputedStyle(el).opacity) < 0.99).length,
    }));
    expect(m.stacked, 'reduced motion still got the scrolling scene').toBe(true);
    expect(m.stages).toBe(6);
    expect(m.transitions, 'elements still animate under reduced motion').toBe(0);
    expect(m.faded, 'a state is dimmed and unreadable').toBe(0);
  });
});

test.describe('scroll scene robustness', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('paging with the keyboard advances through the states, not past them', async ({ page }) => {
    // The defect this caught: a thin activation band is narrower than a
    // PageDown, so a keyboard reader jumped from the first state to the last
    // and saw none of the mechanism.
    await page.goto('/#engine');
    await page.waitForSelector('.scene-captions > li');
    await page.evaluate(() => window.scrollTo(0, 0));
    const seen = [];
    let lastY = -1, still = 0;
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press('PageDown');
      await page.waitForTimeout(110);
      const s = await page.evaluate(() => {
        const a = document.querySelector('.scene-captions > li.active');
        const g = document.querySelector('.scene-grid').getBoundingClientRect();
        return { y: Math.round(window.scrollY), active: a ? Number(a.dataset.index) : null,
                 inScene: g.top < window.innerHeight && g.bottom > 0 };
      });
      if (s.inScene && s.active !== null) seen.push(s.active);
      still = s.y === lastY ? still + 1 : 0;
      lastY = s.y;
      if (still > 1) break;
    }
    const distinct = [...new Set(seen)];
    expect(distinct.length, `paging surfaced only states ${distinct.join(', ')}`).toBeGreaterThanOrEqual(4);
    // Whatever the stage skips, the text never is: captions are flow content.
    const captions = await page.evaluate(() =>
      [...document.querySelectorAll('.scene-captions .scene-caption')].map(p => p.innerText.trim().length));
    expect(captions.length).toBe(6);
    expect(captions.every(n => n > 40), 'a caption is missing its text').toBe(true);
  });

  test('jumping around out of order lands on the right state every time', async ({ page }) => {
    await page.goto('/#engine');
    await page.waitForSelector('.scene-captions > li');
    const order = [0, 5, 1, 4, 2, 3, 0, 5];
    const got = [];
    for (const i of order) {
      await page.evaluate(j => document.querySelectorAll('.scene-captions > li')[j]
        .scrollIntoView({ block: 'center', behavior: 'instant' }), i);
      await page.waitForTimeout(140);
      got.push(await page.evaluate(() => {
        const a = document.querySelector('.scene-captions > li.active');
        return a ? Number(a.dataset.index) : null;
      }));
    }
    expect(got).toEqual(order);
  });

  test('resizing across the fallback threshold keeps the reader where they were', async ({ page }) => {
    await page.goto('/#engine');
    await page.waitForSelector('.scene-captions > li');
    await page.evaluate(() => document.querySelectorAll('.scene-captions > li')[3]
      .scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.waitForTimeout(200);

    await page.setViewportSize({ width: 700, height: 900 });
    await page.waitForTimeout(400);
    const narrow = await page.evaluate(() => ({
      stacked: document.querySelector('.scroll-scene').classList.contains('stacked'),
      stages: document.querySelectorAll('.scene-storyboard > li').length,
    }));
    expect(narrow.stacked, 'a narrow window kept the sticky scene').toBe(true);
    expect(narrow.stages).toBe(6);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(500);
    const back = await page.evaluate(() => {
      const a = document.querySelector('.scene-captions > li.active');
      const s = document.querySelector('.scene-sticky');
      return { stacked: document.querySelector('.scroll-scene').classList.contains('stacked'),
               active: a ? Number(a.dataset.index) : null,
               stickyTop: s ? Math.round(s.getBoundingClientRect().top) : null };
    });
    expect(back.stacked).toBe(false);
    expect(back.active, 'the resize lost the reader’s place').toBe(3);
    expect(back.stickyTop).toBe(104);
  });

  test('a deep link into the section renders the scene from its first state', async ({ page }) => {
    await page.goto('/#engine~engine-is-a-scheduler');
    await page.waitForSelector('.scroll-scene');
    const m = await page.evaluate(() => {
      const a = document.querySelector('.scene-captions > li.active');
      return { stacked: document.querySelector('.scroll-scene').classList.contains('stacked'),
               active: a ? Number(a.dataset.index) : null };
    });
    expect(m.stacked).toBe(false);
    expect(m.active).toBe(0);
  });

  test('the scene holds no focusable controls, so tabbing cannot be trapped', async ({ page }) => {
    await page.goto('/#engine');
    await page.waitForSelector('.scroll-scene');
    const focusables = await page.evaluate(() => document.querySelectorAll(
      '.scroll-scene a, .scroll-scene button, .scroll-scene input, .scroll-scene select, .scroll-scene [tabindex]').length);
    expect(focusables, 'the scene is read-only and should hold no controls').toBe(0);
  });
});

/**
 * Every scene, held to the same contract. Adding a fourth means adding a row
 * here, not a new block of tests.
 */
const SCENES = [
  { id: 'scheduler-scene', route: '/#engine', states: 6, stage: '.scheduler-stage' },
  { id: 'phase-scene', route: '/#reuse', states: 6, stage: '.phase-stage' },
  { id: 'placement-scene', route: '/#parallel', states: 5, stage: '.placement-stage' },
];

test.describe('every scroll scene', () => {
  for (const scene of SCENES) {
    test.describe(scene.id, () => {
      test('advances forward and mirrors in reverse', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto(scene.route);
        await page.waitForSelector(`#${scene.id} .scene-captions > li`);
        const step = async i => {
          await page.evaluate(({ id, j }) => document
            .querySelectorAll(`#${id} .scene-captions > li`)[j]
            .scrollIntoView({ block: 'center', behavior: 'instant' }), { id: scene.id, j: i });
          await page.waitForTimeout(170);
          return page.evaluate(id => {
            const el = document.querySelector(`#${id} .scene-captions > li.active`);
            return el ? Number(el.dataset.index) : null;
          }, scene.id);
        };
        const forward = [];
        for (let i = 0; i < scene.states; i++) forward.push(await step(i));
        const reverse = [];
        for (let i = scene.states - 1; i >= 0; i--) reverse.push(await step(i));
        expect(forward).toEqual([...Array(scene.states).keys()]);
        expect(reverse).toEqual([...Array(scene.states).keys()].reverse());
      });

      test('no two consecutive states render an identical stage', async ({ page }) => {
        // The complaint this guards: a scene that reads as a set of fixed
        // frames because neighbouring states look the same.
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto(scene.route);
        await page.waitForSelector(`#${scene.id} .scene-captions > li`);
        const shots = [];
        for (let i = 0; i < scene.states; i++) {
          await page.evaluate(({ id, j }) => document
            .querySelectorAll(`#${id} .scene-captions > li`)[j]
            .scrollIntoView({ block: 'center', behavior: 'instant' }), { id: scene.id, j: i });
          await page.waitForTimeout(320);
          shots.push(await page.evaluate(sel => {
            const stage = document.querySelector(sel);
            // Text plus which parts are emphasised: what a reader would notice.
            const emphasis = [...stage.querySelectorAll('.focus')]
              .map(e => e.className).join('|');
            return `${stage.innerText.replace(/\s+/g, ' ')}##${emphasis}`;
          }, scene.stage));
        }
        for (let i = 1; i < shots.length; i++) {
          expect(shots[i], `states ${i - 1} and ${i} of ${scene.id} are the same picture`)
            .not.toBe(shots[i - 1]);
        }
      });

      test('falls back to a stacked storyboard on a phone', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 });
        await page.goto(scene.route);
        await page.waitForSelector(`#${scene.id}`);
        const m = await page.evaluate(id => ({
          stacked: document.querySelector(`#${id}`).classList.contains('stacked'),
          stages: document.querySelectorAll(`#${id} .scene-storyboard > li`).length,
          shortCaptions: [...document.querySelectorAll(`#${id} .scene-caption`)]
            .filter(p => p.innerText.trim().length < 40).length,
        }), scene.id);
        expect(m.stacked).toBe(true);
        expect(m.stages).toBe(scene.states);
        expect(m.shortCaptions).toBe(0);
      });

      test('carries a figure identifier and a provenance note', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto(scene.route);
        await page.waitForSelector(`#${scene.id}`);
        const m = await page.evaluate(id => {
          const fig = document.querySelector(`#${id}`).closest('.scene-figure');
          return { id: fig.querySelector('.figure-id')?.innerText ?? null,
                   provenance: fig.querySelector('.scene-provenance')?.innerText.trim().length ?? 0 };
        }, scene.id);
        expect(m.id, 'the scene has no figure number').toMatch(/^FIG\./);
        expect(m.provenance, 'the scene does not say where its numbers come from').toBeGreaterThan(80);
      });
    });
  }
});

test.describe('one canvas', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const theme of ['light', 'dark']) {
    test(`the four shell regions are one material (${theme})`, async ({ page }) => {
      // The audit that prompted this found five materials: a cool white on the
      // root, and separate tones for masthead, sidebar, explorer and its wells.
      await page.goto('/#feasibility');
      await page.waitForSelector('.article');
      await page.evaluate(t => { document.documentElement.dataset.theme = t; }, theme);
      await page.waitForTimeout(250);
      const m = await page.evaluate(() => {
        const bg = s => { const e = document.querySelector(s); return e ? getComputedStyle(e).backgroundColor : null; };
        const clear = c => c === null || c === 'rgba(0, 0, 0, 0)' || c === 'transparent';
        return {
          regionsClear: ['.sidebar', '.workspace', '.article', '.page-rail', '.explorer']
            .filter(s => !clear(bg(s))),
          sidebarBorderRight: parseFloat(getComputedStyle(document.querySelector('.sidebar')).borderRightWidth),
          canvasIsDark: getComputedStyle(document.documentElement).backgroundColor,
        };
      });
      expect(m.regionsClear, `these still paint their own background: ${m.regionsClear.join(', ')}`).toEqual([]);
      expect(m.sidebarBorderRight, 'the sidebar still has a wall').toBe(0);
      const rgb = m.canvasIsDark.match(/\d+/g).map(Number);
      const light = (rgb[0] + rgb[1] + rgb[2]) / 3 > 128;
      expect(light, `canvas is ${m.canvasIsDark} in ${theme}`).toBe(theme === 'light');
    });
  }

  test('navigation shows the active item without a filled rectangle', async ({ page }) => {
    await page.goto('/#feasibility');
    await page.waitForSelector('.nav-group a.active');
    const m = await page.evaluate(() => {
      const a = document.querySelector('.nav-group a.active');
      const other = [...document.querySelectorAll('.nav-group a')].find(n => n !== a);
      const cs = getComputedStyle(a);
      const marker = getComputedStyle(a, '::before');
      return { bg: cs.backgroundColor, colour: cs.color, weight: Number(cs.fontWeight),
               inactiveColour: getComputedStyle(other).color,
               inactiveWeight: Number(getComputedStyle(other).fontWeight),
               markerContent: marker.content, markerBg: marker.backgroundColor };
    });
    expect(m.bg, 'the active item is still a filled rectangle').toBe('rgba(0, 0, 0, 0)');
    // Removing the rectangle is only acceptable if the item is still obviously
    // active: it must differ from its neighbours in colour and weight, and
    // carry a marker.
    expect(m.colour, 'active and inactive items are the same colour').not.toBe(m.inactiveColour);
    expect(m.weight, 'active item is not heavier than its neighbours').toBeGreaterThan(m.inactiveWeight);
    expect(m.markerContent, 'the active item lost its marker').not.toBe('none');
    expect(m.markerBg, 'the marker is invisible').not.toBe('rgba(0, 0, 0, 0)');
  });

  test('semantic colour stays rare enough to mean something', async ({ page }) => {
    // Data marks encode values and are excluded; this measures chrome and type.
    await page.goto('/#measure');
    await page.waitForSelector('.bound-row');
    await page.evaluate(() => document.querySelector('.explorer').scrollIntoView({ block: 'start', behavior: 'instant' }));
    await page.waitForTimeout(300);
    const density = await page.evaluate(() => {
      const semantic = ['60, 84, 64', '46, 107, 107', '107, 122, 69', '180, 85, 47'];
      let coloured = 0, total = 0;
      document.querySelectorAll('.article *').forEach(el => {
        if (el.closest('.stream-strip, .fan-chart, .pool-grid, .token-field, .device-grid, .expert-grid')) return;
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > window.innerHeight) return;
        total++;
        const cs = getComputedStyle(el);
        if ([cs.color, cs.backgroundColor].some(c => semantic.some(s => c.includes(s)))) coloured++;
      });
      return { total, coloured, percent: Math.round(100 * coloured / total) };
    });
    expect(density.percent, `${density.coloured} of ${density.total} visible elements carry semantic colour`)
      .toBeLessThanOrEqual(20);
  });
});

/** Every living example (Type A) shares one player, so one table covers them. */
const PLAYERS = [
  { name: 'decode walkthrough', route: '/#feasibility', stage: '.walk-stage' },
  { name: 'engine step loop', route: '/#engine', stage: '.sim-stage' },
  { name: 'speculation round', route: '/#speculate', stage: '.sim-stage' },
  { name: 'token stream', route: '/#measure', stage: '.stream-strip-wrap' },
];

test.describe('editorial playback', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const player of PLAYERS) {
    test(`${player.name}: starts on entry, and the concept is the controller`, async ({ page }) => {
      await page.goto(player.route);
      await page.waitForSelector('.playback');
      // Nothing moves until it is meaningfully visible.
      expect(await page.evaluate(() => document.querySelector('.playback').dataset.mode)).toBe('idle');

      await page.evaluate(s => document.querySelector(s).scrollIntoView({ block: 'center', behavior: 'instant' }), player.stage);
      await page.waitForTimeout(900);
      expect(await page.evaluate(() => document.querySelector('.playback').dataset.mode)).toBe('playing');

      const shape = await page.evaluate(() => ({
        stages: document.querySelectorAll('.stage-rail li button').length,
        legacy: document.querySelectorAll('.transport-buttons, .transport-speed').length,
        speedVisible: !!document.querySelector('.playback-menu'),
        primaries: document.querySelectorAll('.playback-primary').length,
      }));
      expect(shape.stages, 'the stages are not navigable').toBeGreaterThanOrEqual(2);
      expect(shape.legacy, 'the old transport survives').toBe(0);
      expect(shape.speedVisible, 'speed is on permanent display').toBe(false);
      expect(shape.primaries, 'there should be exactly one primary control').toBe(1);
    });
  }

  test('a user pause survives scrolling away and back; a system suspension does not', async ({ page }) => {
    await page.goto('/#engine');
    await page.waitForSelector('.playback');
    const mode = () => page.evaluate(() => document.querySelector('.playback').dataset.mode);
    const into = () => page.evaluate(() => document.querySelector('.sim-stage').scrollIntoView({ block: 'center', behavior: 'instant' }));
    const away = () => page.evaluate(() => window.scrollTo(0, 0));

    await into(); await page.waitForTimeout(800);
    expect(await mode()).toBe('playing');
    await away(); await page.waitForTimeout(600);
    expect(await mode(), 'leaving the viewport should suspend, not pause').toBe('system_suspended');
    await into(); await page.waitForTimeout(600);
    expect(await mode(), 'returning should resume a system suspension').toBe('playing');

    await page.click('.playback-primary');
    await page.waitForTimeout(250);
    expect(await mode()).toBe('user_paused');
    await away(); await page.waitForTimeout(600);
    await into(); await page.waitForTimeout(800);
    expect(await mode(), 'scrolling restarted an example the learner had paused').toBe('user_paused');
  });

  test('clicking a stage jumps there and yields control', async ({ page }) => {
    await page.goto('/#engine');
    await page.waitForSelector('.stage-rail');
    await page.evaluate(() => document.querySelector('.sim-stage').scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.waitForTimeout(700);
    await page.click('.stage-rail li:last-child button');
    await page.waitForTimeout(300);
    const m = await page.evaluate(() => ({
      mode: document.querySelector('.playback').dataset.mode,
      count: document.querySelector('.playback-count').innerText,
      verb: document.querySelector('.playback-primary').innerText.trim(),
    }));
    expect(m.mode, 'it kept playing while the learner inspected a stage').toBe('user_paused');
    const [at, total] = m.count.split('/').map(n => Number(n.trim()));
    expect(at).toBe(total);
    // §13: at the end the verb is replay, not play, whatever got us here.
    expect(m.verb).toBe('Replay');
  });

  test('replay restarts from the first frame', async ({ page }) => {
    await page.goto('/#engine');
    await page.waitForSelector('.stage-rail');
    await page.evaluate(() => document.querySelector('.sim-stage').scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.waitForTimeout(700);
    await page.click('.stage-rail li:last-child button');
    await page.waitForTimeout(250);
    await page.click('.playback-primary');
    await page.waitForTimeout(400);
    const m = await page.evaluate(() => ({
      mode: document.querySelector('.playback').dataset.mode,
      at: Number(document.querySelector('.playback-count').innerText.split('/')[0].trim()),
    }));
    expect(m.mode).toBe('playing');
    expect(m.at).toBeLessThanOrEqual(3);
  });

  test('the settings menu opens, offers speed, and dismisses', async ({ page }) => {
    await page.goto('/#engine');
    await page.waitForSelector('.playback-more');
    await page.click('.playback-more');
    await page.waitForTimeout(200);
    const speeds = await page.evaluate(() => [...document.querySelectorAll('.playback-menu button')].map(b => b.innerText));
    expect(speeds.length, 'speed is unreachable').toBeGreaterThanOrEqual(3);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    // A menu left open covers the stage rail and swallows its clicks.
    expect(await page.evaluate(() => !!document.querySelector('.playback-menu'))).toBe(false);
  });

  test('controls are real buttons with labels, and big enough to hit', async ({ page }) => {
    await page.goto('/#engine');
    await page.waitForSelector('.playback');
    const m = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll('.playback-primary, .playback-more, .stage-rail button, .scenario-nav button')];
      return {
        allButtons: nodes.every(n => n.tagName === 'BUTTON'),
        primaryLabelled: !!document.querySelector('.playback-primary').getAttribute('aria-label'),
        moreLabelled: !!document.querySelector('.playback-more').getAttribute('aria-label'),
        small: nodes.filter(n => { const r = n.getBoundingClientRect(); return r.height > 0 && r.height < 28; }).length,
      };
    });
    expect(m.allButtons, 'a control is not a button').toBe(true);
    expect(m.primaryLabelled && m.moreLabelled, 'a control has no accessible name').toBe(true);
    expect(m.small, 'a control is too small to hit').toBe(0);
  });
});

test.describe('editorial playback under reduced motion', () => {
  test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });

  test('never starts itself, but stays reachable', async ({ page }) => {
    await page.goto('/#engine');
    await page.waitForSelector('.playback');
    await page.evaluate(() => document.querySelector('.sim-stage').scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.waitForTimeout(1200);
    const still = await page.evaluate(() => ({
      mode: document.querySelector('.playback').dataset.mode,
      at: Number(document.querySelector('.playback-count').innerText.split('/')[0].trim()),
      stages: document.querySelectorAll('.stage-rail li').length,
    }));
    expect(still.mode, 'it autoplayed under reduced motion').not.toBe('playing');
    expect(still.at, 'it advanced under reduced motion').toBeLessThanOrEqual(2);
    // §5: stillness must not remove the explanation.
    expect(still.stages).toBeGreaterThanOrEqual(2);

    await page.click('.playback-primary');
    await page.waitForTimeout(1000);
    expect(await page.evaluate(() => document.querySelector('.playback').dataset.mode),
      'the learner could not start it manually').toBe('playing');
  });
});

test.describe('the token stream arrives', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('the average is poisoned by the stall and never recovers', async ({ page }) => {
    // §27: the reader should see the anomaly happen, not read that it happened.
    await page.goto('/#measure');
    await page.waitForSelector('.stage-rail');
    const read = () => page.evaluate(() => {
      const vals = [...document.querySelectorAll('.bound-row strong')].map(e => e.innerText);
      const num = t => Number((t.match(/[\d.]+/) || [])[0]);
      return { tpot: num(vals[1]), worst: num(vals[2]),
               alarming: !!document.querySelector('.bound-row strong.alarming'),
               bars: document.querySelectorAll('.stream-strip i').length,
               stallBars: document.querySelectorAll('.stream-strip i.stall').length };
    });
    const stage = async n => {
      await page.click(`.stage-rail li:nth-child(${n}) button`);
      await page.waitForTimeout(300);
      return read();
    };

    const steady = await stage(3);
    expect(steady.tpot, 'TPOT should sit on the steady gap before the stall').toBe(40);
    expect(steady.stallBars, 'the stall is visible before it has happened').toBe(0);
    expect(steady.alarming).toBe(false);

    const atStall = await stage(4);
    expect(atStall.tpot, 'the average did not move when the stall landed').toBeGreaterThan(steady.tpot);
    expect(atStall.worst).toBeGreaterThan(steady.worst);
    expect(atStall.stallBars, 'the stall is not marked').toBe(1);
    expect(atStall.alarming, 'the anomaly is not coloured as one').toBe(true);

    const after = await stage(5);
    expect(after.tpot, 'the average recovered, which would be the wrong lesson')
      .toBeGreaterThan(steady.tpot);
  });

  test('nothing has arrived before the first token', async ({ page }) => {
    await page.goto('/#measure');
    await page.waitForSelector('.stage-rail');
    await page.click('.stage-rail li:nth-child(1) button');
    await page.waitForTimeout(250);
    const m = await page.evaluate(() => ({
      bars: document.querySelectorAll('.stream-strip i').length,
      ttft: document.querySelectorAll('.bound-row strong')[0].innerText.trim(),
    }));
    expect(m.bars, 'gaps are drawn before any token has arrived').toBe(0);
    expect(m.ttft.toLowerCase()).toContain('n/a');
  });
});

test.describe('no native control chrome anywhere', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  // The playback scrub was redrawn first and the nine explorers were missed, so
  // this sweeps every chapter rather than trusting one.
  const ROUTES_WITH_CONTROLS = ['#feasibility', '#hardware', '#reuse', '#engine',
    '#measure', '#profile', '#parallel', '#quantize', '#speculate'];

  test('every slider and dropdown is drawn by the page, not the browser', async ({ page }) => {
    for (const route of ROUTES_WITH_CONTROLS) {
      await page.goto('/' + route);
      await page.waitForSelector('.article');
      await page.waitForTimeout(250);
      const bad = await page.evaluate(() => {
        const out = [];
        for (const el of document.querySelectorAll('.ds input[type="range"]')) {
          const cs = getComputedStyle(el);
          if (cs.appearance !== 'none') out.push('range keeps native appearance');
          if (cs.boxShadow !== 'none') out.push('range is raised');
          // Without a published fraction the fill cannot be drawn.
          if (el.style.getPropertyValue('--progress') === '') out.push('range has no --progress');
        }
        for (const el of document.querySelectorAll('.ds select')) {
          const cs = getComputedStyle(el);
          if (cs.appearance !== 'none') out.push('select keeps the OS arrows');
          if (!cs.backgroundImage.includes('svg')) out.push('select has no drawn chevron');
        }
        return [...new Set(out)];
      });
      expect(bad, `${route}: ${bad.join('; ')}`).toEqual([]);
    }
  });
});

test.describe('the playback timeline is notation, not a slider', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('no native range rendering survives', async ({ page }) => {
    // Chrome exposes neither ::-webkit-slider-thumb nor its track to
    // getComputedStyle, so the cap and rule are checked by eye against the
    // screenshots in scratchpad/timeline. What is observable is asserted here:
    // the browser is not drawing this control, and nothing is raised.
    await page.goto('/#engine');
    await page.waitForSelector('.playback-scrub');
    const m = await page.evaluate(() => {
      const cs = getComputedStyle(document.querySelector('.playback-scrub'));
      return { appearance: cs.appearance, background: cs.backgroundColor,
               shadow: cs.boxShadow, border: cs.borderTopWidth };
    });
    expect(m.appearance, 'the native slider appearance is back').toBe('none');
    expect(m.background, 'the track has a rail behind it').toBe('rgba(0, 0, 0, 0)');
    expect(m.shadow, 'the control is raised').toBe('none');
    expect(m.border).toBe('0px');
  });

  test('the fill tracks the cursor, and the tick is revealed only on demand', async ({ page }) => {
    await page.goto('/#engine');
    await page.waitForSelector('.playback-timeline');
    const progress = () => page.evaluate(() =>
      parseFloat(getComputedStyle(document.querySelector('.playback-timeline')).getPropertyValue('--progress')));
    const tickOpacity = () => page.evaluate(() =>
      Number(getComputedStyle(document.querySelector('.playback-tick')).opacity));

    await page.evaluate(() => document.querySelectorAll('.stage-rail li')[0].querySelector('button').click());
    await page.waitForTimeout(250);
    const atStart = await progress();

    await page.evaluate(() => {
      const items = document.querySelectorAll('.stage-rail li');
      items[items.length - 1].querySelector('button').click();
    });
    await page.waitForTimeout(250);
    const atEnd = await progress();

    expect(atStart).toBeLessThan(0.2);
    expect(atEnd).toBeGreaterThan(0.9);

    await page.mouse.move(5, 5);
    await page.waitForTimeout(300);
    expect(await tickOpacity(), 'the scrub marker is showing at rest').toBe(0);
    await page.hover('.playback-timeline');
    await page.waitForTimeout(350);
    expect(await tickOpacity(), 'the scrub marker never appears').toBe(1);
  });
});

test.describe('data marks are on the semantic palette', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  // Every bar, meter and mark predating the palette. The shell moved onto
  // tokens and these did not, so nine chapters drew from a sage green, a dusty
  // blue and a tan that meant different things in different places.
  const RETIRED = [
    'rgb(125, 151, 117)', 'rgb(139, 163, 127)', 'rgb(109, 138, 101)', 'rgb(95, 125, 87)',
    'rgb(168, 190, 201)', 'rgb(144, 166, 182)',
    'rgb(212, 198, 170)', 'rgb(217, 180, 143)', 'rgb(171, 158, 132)',
    'rgb(172, 101, 82)', 'rgb(143, 168, 134)', 'rgb(102, 133, 111)', 'rgb(165, 160, 182)',
  ];
  const ROUTES = ['#feasibility', '#hardware', '#reuse', '#engine', '#measure',
    '#profile', '#parallel', '#quantize', '#speculate', '#production'];

  test('no chapter draws from a retired colour', async ({ page }) => {
    for (const route of ROUTES) {
      await page.goto('/' + route);
      await page.waitForSelector('.article');
      await page.waitForTimeout(250);
      const hits = await page.evaluate(retired => {
        const found = new Set();
        document.querySelectorAll('.ds *').forEach(el => {
          const cs = getComputedStyle(el);
          for (const prop of ['backgroundColor', 'borderTopColor', 'color']) {
            if (retired.includes(cs[prop])) {
              const cls = (typeof el.className === 'string' ? el.className.trim().split(/\s+/)[0] : el.tagName) || el.tagName;
              found.add(`${cls} ${prop} ${cs[prop]}`);
            }
          }
        });
        return [...found];
      }, RETIRED);
      expect(hits, `${route}: ${hits.join('; ')}`).toEqual([]);
    }
  });

  test('explanatory content carries no card, only controls and artifacts do', async ({ page }) => {
    // A rectangle is allowed around something a hand operates, around code,
    // and around a plot area. Never around an explanation.
    const allowed = /^(SELECT|BUTTON|INPUT|PRE|CODE|token-field|device-fill|weight|cache|hatched|pool-block|expert-grid|stream-strip)$/;
    for (const route of ROUTES) {
      await page.goto('/' + route);
      await page.waitForSelector('.article');
      await page.waitForTimeout(250);
      const boxes = await page.evaluate(() => {
        const hits = new Set();
        document.querySelectorAll('.ds .article *').forEach(el => {
          const cs = getComputedStyle(el);
          const sides = ['Top', 'Right', 'Bottom', 'Left']
            .filter(s => parseFloat(cs['border' + s + 'Width']) > 0);
          const filled = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent';
          const b = el.getBoundingClientRect();
          if (b.width > 200 && (sides.length === 4 || (filled && b.height > 40))) {
            hits.add((typeof el.className === 'string' ? el.className.trim().split(/\s+/)[0] : el.tagName) || el.tagName);
          }
        });
        return [...hits];
      });
      const unexpected = boxes.filter(b => !allowed.test(b));
      expect(unexpected, `${route} boxes: ${unexpected.join(', ')}`).toEqual([]);
    }
  });
});

test.describe('relationships are composed, not punctuated', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  const ROUTES = ['#feasibility', '#hardware', '#reuse', '#engine', '#measure',
    '#profile', '#parallel', '#quantize', '#speculate', '#production'];

  test('no chapter falls back to a row of labels joined by arrows', async ({ page }) => {
    // The first pass converted two of these and I recorded it as done; there
    // were eight. This sweeps rather than samples.
    for (const route of ROUTES) {
      await page.goto('/' + route);
      await page.waitForSelector('.article');
      await page.waitForTimeout(200);
      const m = await page.evaluate(() => ({
        arrowRows: document.querySelectorAll('.decision-flow').length,
        sequences: document.querySelectorAll('.sequence').length,
      }));
      expect(m.arrowRows, `${route} still has an arrow row`).toBe(0);
      expect(m.sequences, `${route} lost its sequence`).toBeGreaterThan(0);
    }
  });

  test('a sequence states what each stop answers, and transforms when narrow', async ({ page }) => {
    await page.goto('/#profile');
    await page.waitForSelector('.sequence');
    const wide = await page.evaluate(() => {
      const steps = [...document.querySelectorAll('.sequence-steps > li')];
      return {
        stops: steps.length,
        allNumbered: steps.every(s => /^\d\d$/.test(s.querySelector('.sequence-number')?.innerText.trim() ?? '')),
        allAnswered: steps.every(s => (s.querySelector('.sequence-question')?.innerText.trim().length ?? 0) > 5),
        columns: getComputedStyle(document.querySelector('.sequence-steps')).gridTemplateColumns.split(' ').length,
      };
    });
    expect(wide.stops).toBeGreaterThanOrEqual(3);
    expect(wide.allNumbered, 'a stop lost its number').toBe(true);
    expect(wide.allAnswered, 'a stop says what it is but not what it answers').toBe(true);
    expect(wide.columns, 'the sequence is not laid out across the track').toBe(wide.stops);

    // Module 14 §27: the relationship survives, the desktop geometry does not.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(300);
    const narrow = await page.evaluate(() => ({
      columns: getComputedStyle(document.querySelector('.sequence-steps')).gridTemplateColumns.split(' ').length,
      stops: document.querySelectorAll('.sequence-steps > li').length,
    }));
    expect(narrow.columns, 'the sequence was shrunk rather than transformed').toBe(1);
    expect(narrow.stops, 'a stop was dropped on a phone').toBe(wide.stops);
  });
});

test.describe('the device trade-off states its claim with real objects', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('three stages, real figures, and colour only on the consequence', async ({ page }) => {
    await page.goto('/#parallel');
    await page.waitForSelector('.tradeoff');
    const m = await page.evaluate(() => {
      const t = document.querySelector('.tradeoff');
      const warning = getComputedStyle(document.documentElement).getPropertyValue('--warning').trim();
      const stages = [...t.querySelectorAll('.tradeoff-stages > li')];
      const named = el => getComputedStyle(el).color;
      return {
        stages: stages.length,
        figures: [...t.querySelectorAll('.tradeoff-figure b')].map(e => e.innerText),
        coloured: stages.filter(s => s.classList.contains('consequence')).length,
        consequenceIsLast: stages[stages.length - 1].classList.contains('consequence'),
        devicesShown: t.querySelectorAll('.tradeoff-device').length,
        collectives: t.querySelectorAll('.tradeoff-collectives > i').length,
        claim: t.querySelector('.tradeoff-claim').innerText.length,
        warning,
        nameColours: stages.map(s => named(s.querySelector('.tradeoff-name'))),
      };
    });
    expect(m.stages).toBe(3);
    // Cause, transformation, consequence: the numbers are placeMemory's, so a
    // figure that stops matching the model is a figure that became false.
    expect(m.figures[0]).toMatch(/^\d+ GB$/);
    expect(m.figures[1]).toMatch(/^\d+ GB$/);
    expect(Number(m.figures[2])).toBeGreaterThan(0);
    expect(Number(m.figures[0].split(' ')[0]))
      .toBeGreaterThan(Number(m.figures[1].split(' ')[0]));
    // One device drawn, then eight; the collectives match the rank count.
    expect(m.devicesShown).toBe(9);
    expect(m.collectives).toBe(7);
    // §19: only the consequence takes colour.
    expect(m.coloured, 'more than one stage is emphasised').toBe(1);
    expect(m.consequenceIsLast).toBe(true);
    expect(m.claim, 'the claim is missing').toBeGreaterThan(80);
  });
});

/* ==========================================================================
   Module 15 — the contextual masthead and the Field Guide
   ========================================================================== */

test.describe('the masthead says where you are, not what you can click', () => {
  test('context replaces the generic nav on every route', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    // §2: the old row is gone everywhere, not only on the page I looked at.
    for (const route of ['home', 'feasibility', 'hardware', 'reuse', 'equations',
                         'engine', 'measure', 'profile', 'parallel', 'quantize',
                         'speculate', 'production', 'roadmap', 'radar', 'sources',
                         'library', 'bookmarks']) {
      await page.goto(`/#${route}`);
      await page.waitForTimeout(250);
      const m = await page.evaluate(() => {
        const ctx = document.querySelector('.masthead-context:not(.is-empty)');
        return {
          oldNav: document.querySelectorAll('.topnav > a').length,
          hamburger: !!document.querySelector('.mobile-menu'),
          eyebrow: ctx?.querySelector('.context-where')?.innerText || null,
          title: ctx?.querySelector('.context-title')?.innerText || null,
          opensGuide: ctx?.getAttribute('aria-controls') || null,
          name: ctx?.getAttribute('aria-label') || null,
          search: !!document.querySelector('.search-trigger'),
          index: !!document.querySelector('.index-trigger'),
        };
      });
      expect(m.oldNav, `Study / Library / Saved survives on #${route}`).toBe(0);
      expect(m.hamburger, `a generic hamburger survives on #${route}`).toBe(false);
      // §26: search stays reachable from every page.
      expect(m.search && m.index, `a utility is missing on #${route}`).toBe(true);

      if (route === 'home') {
        // §8: the home masthead carries the publication, not a location.
        expect(m.title, 'home invents a location').toBe(null);
        continue;
      }
      expect(m.title, `#${route} does not say where the reader is`).toBeTruthy();
      expect(m.eyebrow, `#${route} has no section`).toBeTruthy();
      // §21: a semantic control with a name that says what it opens, and §11:
      // it opens the structure this page actually belongs to.
      expect(m.opensGuide, `#${route} points at no structure`).toMatch(/^(sidebar-nav|index-panel)$/);
      expect(m.name).toMatch(
        m.opensGuide === 'sidebar-nav' ? /^Open the Field Guide/ : /^Open the Index/);
      expect(m.name, `#${route} does not say where the reader is`).toContain(m.title);
      // §10: the affordance is not a chevron.
      expect(m.title).not.toMatch(/[▾▼⌄]/);
    }
  });

  test('the context block reveals the Field Guide and lands focus in it', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/#hardware');
    await page.waitForSelector('.masthead-context');
    // Collapsed rail: clicking the context must bring the curriculum back.
    await page.click('.nav-collapse');
    await page.waitForTimeout(250);
    expect(await page.evaluate(() => document.documentElement.dataset.nav)).toBe('collapsed');
    await page.click('.masthead-context');
    await page.waitForTimeout(300);
    const wide = await page.evaluate(() => ({
      collapsed: document.documentElement.dataset.nav === 'collapsed',
      inGuide: !!document.activeElement.closest('#sidebar-nav'),
      onCurrent: document.activeElement.classList.contains('active'),
    }));
    expect(wide.collapsed, 'the Field Guide stayed collapsed').toBe(false);
    expect(wide.inGuide, 'focus did not move into the Field Guide').toBe(true);
    expect(wide.onCurrent, 'focus did not land on the current lesson').toBe(true);

    // §19: on a phone the same control is how the drawer opens.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/#hardware');
    await page.waitForTimeout(400);
    expect(await page.locator('.sidebar.open').count()).toBe(0);
    await page.click('.masthead-context');
    await page.waitForTimeout(300);
    expect(await page.locator('.sidebar.open').count(), 'the drawer did not open').toBe(1);
  });

  test('aria-expanded describes the structure the control governs', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/#hardware');
    await page.waitForSelector('.masthead-context');
    const state = () => page.evaluate(() => {
      const c = document.querySelector('.masthead-context');
      return { expanded: c.getAttribute('aria-expanded'), controls: c.getAttribute('aria-controls') };
    });
    // The rail is there, so the guide is expanded — it used to report the phone
    // drawer's state and say "false" while the curriculum was on screen.
    expect(await state()).toEqual({ expanded: 'true', controls: 'sidebar-nav' });
    await page.click('.nav-collapse');
    await page.waitForTimeout(250);
    expect((await state()).expanded, 'collapsed, but still reported as open').toBe('false');
    await page.click('.masthead-context');
    await page.waitForTimeout(250);
    expect((await state()).expanded).toBe('true');

    // §11: a page the Field Guide does not list opens the Index instead, and
    // the state it reports is the Index's.
    for (const route of ['sources', 'roadmap', 'radar', 'library', 'bookmarks']) {
      await page.goto(`/#${route}`);
      await page.waitForTimeout(300);
      expect((await state()), `#${route} sends the reader to a guide without it`)
        .toEqual({ expanded: 'false', controls: 'index-panel' });
      await page.click('.masthead-context');
      await page.waitForTimeout(300);
      expect(await page.evaluate(() => document.querySelector('.index-panel').open)).toBe(true);
      expect((await state()).expanded).toBe('true');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
    }
  });

  test('the drawer band has no second control of its own', async ({ page }) => {
    // 761-1024: the sidebar is a drawer here too, and the hamburger that used
    // to be its only opener is gone.
    for (const width of [768, 900, 1024]) {
      await page.setViewportSize({ width, height: 800 });
      // An identical URL is a same-document navigation, which would carry the
      // previous iteration's open drawer over.
      await page.goto('about:blank');
      await page.goto('/#hardware');
      await page.waitForTimeout(400);
      expect(await page.locator('.mobile-menu').count(), `a hamburger survives at ${width}px`).toBe(0);
      expect(await page.locator('.sidebar.open').count(),
        `the drawer is already open at ${width}px`).toBe(0);
      await page.click('.masthead-context');
      await page.waitForTimeout(350);
      expect(await page.locator('.sidebar.open').count(),
        `the Field Guide cannot be opened at ${width}px`).toBe(1);
    }
  });

  test('the Field Guide is revealed on the one canvas', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/#hardware');
    await page.waitForSelector('.sidebar');
    const m = await page.evaluate(() => {
      const cs = getComputedStyle(document.querySelector('.sidebar'));
      return { bg: cs.backgroundColor, shadow: cs.boxShadow, border: cs.borderRightWidth, radius: cs.borderRadius };
    });
    // §7: no wall, no card, no drawer material.
    expect(m.bg, 'the Field Guide paints its own background').toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
    expect(m.shadow, 'the Field Guide floats').toBe('none');
    expect(m.border, 'the Field Guide is a vertical wall').toBe('0px');

    // The lesson itself is marked by type and a gutter dot, not by a block of
    // colour — in both themes. The dark palette used to re-fill it.
    for (const theme of ['light', 'dark']) {
      await page.evaluate(t => { document.documentElement.dataset.theme = t; }, theme);
      await page.waitForTimeout(150);
      const filled = await page.evaluate(() => {
        const painted = e => {
          const bg = getComputedStyle(e).backgroundColor;
          return bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent';
        };
        const active = document.querySelector('#sidebar-nav a.active');
        active.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        return [...document.querySelectorAll('#sidebar-nav a')].filter(painted).length;
      });
      expect(filled, `a lesson is a filled block in ${theme}`).toBe(0);
    }
    await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
  });

  test('the Index reveals the product and does not repeat the curriculum', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/#hardware');
    await page.click('.index-trigger');
    await page.waitForTimeout(300);
    const m = await page.evaluate(() => {
      const panel = document.querySelector('.index-panel');
      const links = [...panel.querySelectorAll('.index-sections a')];
      const guide = [...document.querySelectorAll('#sidebar-nav a')].map(a => a.innerText.trim());
      const cs = getComputedStyle(panel);
      return {
        open: panel.open,
        sections: [...panel.querySelectorAll('.index-name')].map(e => e.innerText.trim()),
        numbered: panel.querySelectorAll('.index-number').length,
        lessonsRepeated: links.filter(a => guide.includes(a.innerText.trim())).length,
        bg: cs.backgroundColor,
        radius: cs.borderRadius,
        canTheme: !!panel.querySelector('.index-appearance button'),
      };
    });
    expect(m.open).toBe(true);
    // §11 and §12: whole product, numbered, and not a second Field Guide.
    expect(m.sections).toEqual(expect.arrayContaining(['Study', 'Library', 'Field notes', 'About']));
    expect(m.numbered).toBeGreaterThanOrEqual(4);
    expect(m.lessonsRepeated, 'the Index repeats Field Guide lessons').toBe(0);
    // §12: one canvas, an editorial layer rather than a floating dropdown.
    expect(m.radius).toBe('0px');
    // §15: appearance lives here rather than in the masthead.
    expect(m.canTheme, 'Appearance is not reachable from the Index').toBe(true);
    expect(await page.locator('.topbar .theme-toggle').count(), 'the theme toggle is still in the masthead').toBe(0);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => document.querySelector('.index-panel').open)).toBe(false);
  });

  test('the bar is as tall as what it holds, at every width', async ({ page }) => {
    for (const width of [375, 768, 1024, 1280, 1440, 1920, 2560]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/#hardware');
      await page.waitForTimeout(350);
      const m = await page.evaluate(() => {
        const bar = document.querySelector('.topbar').getBoundingClientRect();
        const title = document.querySelector('.context-title').getBoundingClientRect();
        const work = document.querySelector('.workspace').getBoundingClientRect();
        return {
          clipped: title.bottom > bar.bottom + 1,
          hidden: work.top < bar.bottom - 1,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });
      expect(m.clipped, `the title is clipped by the bar at ${width}px`).toBe(false);
      expect(m.hidden, `content sits under the bar at ${width}px`).toBe(false);
      expect(m.overflow, `the masthead overflows at ${width}px`).toBeLessThanOrEqual(0);
    }
  });
});

test.describe('the masthead under reduced motion', () => {
  test.use({ viewport: { width: 900, height: 800 }, reducedMotion: 'reduce' });

  test('the Field Guide arrives rather than travels, and still opens', async ({ page }) => {
    await page.goto('/#hardware');
    await page.waitForSelector('.masthead-context');
    const moving = await page.evaluate(() => {
      const t = getComputedStyle(document.querySelector('.sidebar')).transitionDuration;
      return t.split(',').some(d => parseFloat(d) > 0);
    });
    expect(moving, 'the drawer still slides under reduced motion').toBe(false);
    await page.click('.masthead-context');
    await page.waitForTimeout(200);
    expect(await page.locator('.sidebar.open').count(), 'reduced motion cost the reader the guide').toBe(1);
  });
});

/* ==========================================================================
   The search overlay — warm frosted paper, crisp ink
   ========================================================================== */

test.describe('search is a translucent material carrying opaque information', () => {
  test.use({ viewport: { width: 1440, height: 950 } });

  const openSearch = async page => {
    await page.goto('/#hardware');
    await page.waitForSelector('.search-trigger');
    await page.click('.search-trigger');
    await page.waitForSelector('.search-dialog[open]');
    await page.waitForTimeout(350);
  };

  test('the sheet has a material of its own, and it is warm', async ({ page }) => {
    await openSearch(page);
    const m = await page.evaluate(() => {
      const cs = getComputedStyle(document.querySelector('.search-dialog'));
      const rgba = cs.backgroundColor.match(/[\d.]+/g).map(Number);
      return { rgba, radius: cs.borderRadius, shadow: cs.boxShadow };
    });
    const [r, g, b, a] = m.rgba;
    // The one-canvas layer remaps --surface to transparent for page regions.
    // The panel is an object, not a region: it must not inherit that.
    expect(a, 'the search panel has no material of its own').toBeGreaterThan(0.8);
    expect(a, 'the panel went opaque and stopped being a translucent sheet').toBeLessThan(0.96);
    // Warm: red above blue, as the canvas is. A neutral or cool grey fails.
    expect(r, 'the sheet is not a warm paper').toBeGreaterThan(b + 5);
  });

  test('the publication behind is perceptible but not readable', async ({ page }) => {
    // Measured, not asserted from the stylesheet: the same patch of page, with
    // and without the sheet over it, directly above the largest type on it.
    const patch = { x: 1005, y: 255, width: 28, height: 80 };
    const spread = async () => {
      const shot = await page.screenshot({ clip: patch });
      // PNG is opaque here; sample luminance range via the raw framebuffer
      return page.evaluate(async b64 => {
        const img = new Image();
        img.src = 'data:image/png;base64,' + b64;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const d = ctx.getImageData(0, 0, c.width, c.height).data;
        const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
        let min = 2, max = 0;
        for (let i = 0; i < d.length; i += 4) {
          const l = 0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2]);
          if (l < min) min = l; if (l > max) max = l;
        }
        return max - min;
      }, shot.toString('base64'));
    };
    await page.goto('/#hardware');
    await page.waitForTimeout(600);
    const bare = await spread();
    await openSearch(page);
    const through = await spread();
    expect(bare, 'the reference patch does not contain the headline').toBeGreaterThan(0.4);
    // The page must recede: at least 95% of the headline's contrast removed.
    expect(through / bare, 'the article behind search still competes').toBeLessThan(0.05);
    // ...and it must not go black: the sheet is warm paper, not a dark scrim.
    expect(through, 'the page behind has been obliterated, not receded').toBeGreaterThan(0);
  });

  test('the information on the sheet is not transparent', async ({ page }) => {
    await openSearch(page);
    const m = await page.evaluate(() => {
      const op = s => getComputedStyle(document.querySelector(s)).opacity;
      return {
        title: op('.search-results > a b'),
        desc: op('.search-results > a p'),
        label: op('.search-label'),
        footer: op('.search-footer'),
        titleColour: getComputedStyle(document.querySelector('.search-results > a b')).color,
      };
    });
    // §32: the failure mode is "everything was given 50% opacity". Contrast is
    // carried by colour against the sheet, never by making the ink see-through.
    for (const [name, value] of Object.entries(m)) {
      if (name === 'titleColour') continue;
      expect(Number(value), `${name} is a transparent piece of information`).toBe(1);
    }
    expect(m.titleColour, 'the result title is not at full ink').toBe('rgb(20, 20, 20)');
  });

  test('results are index entries, not cards, and carry editorial notation', async ({ page }) => {
    await openSearch(page);
    const m = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('.search-results > a')];
      const cs = getComputedStyle(rows[0]);
      return {
        count: rows.length,
        numbers: rows.map(r => r.querySelector('.result-index')?.innerText),
        radius: cs.borderRadius,
        restBg: cs.backgroundColor,
        iconBoxes: document.querySelectorAll('.result-icon').length,
        mono: getComputedStyle(rows[0].querySelector('.result-index')).fontFamily,
      };
    });
    expect(m.count).toBeGreaterThan(4);
    // §13: the rounded icon containers are gone, replaced by numbering.
    expect(m.iconBoxes, 'the generic icon boxes are still there').toBe(0);
    expect(m.numbers[0]).toBe('01');
    expect(m.numbers[4]).toBe('05');
    expect(m.mono.toLowerCase()).toMatch(/mono/);
    // §12: no card at rest.
    expect(m.radius).toBe('0px');
    expect(m.restBg).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
  });

  test('keyboard selection is unmistakable and wraps', async ({ page }) => {
    await openSearch(page);
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(400);   // the gutter marker fades in over 120ms
    const first = await page.evaluate(() => {
      const a = document.activeElement;
      const cs = getComputedStyle(a);
      const marker = getComputedStyle(a, '::before');
      return {
        isResult: a.matches('.search-results > a'),
        title: a.querySelector('b').innerText,
        titleColour: getComputedStyle(a.querySelector('b')).color,
        density: cs.backgroundColor,
        markerOpacity: marker.opacity,
        markerWidth: marker.width,
      };
    });
    expect(first.isResult, 'the arrow key did not move into the results').toBe(true);
    // §14: colour + gutter marker + a slight density shift, not a filled pill.
    expect(first.titleColour, 'the selected title is not on the identity colour').toBe('rgb(60, 84, 64)');
    expect(first.markerOpacity, 'the selection marker is invisible').toBe('1');
    expect(first.markerWidth).toBe('2px');
    expect(first.density).not.toMatch(/rgba\(0, 0, 0, 0\)/);

    // Wrap in both directions, so the list never dead-ends.
    const titles = await page.evaluate(() => [...document.querySelectorAll('.search-results > a b')].map(b => b.innerText));
    const at = () => page.evaluate(() => document.activeElement.querySelector('b').innerText);
    // Focus is on the first entry; up from there wraps to the last, and down
    // from the last comes back round, so the list never dead-ends.
    expect(await at()).toBe(titles[0]);
    await page.keyboard.press('ArrowUp');
    expect(await at()).toBe(titles[titles.length - 1]);
    await page.keyboard.press('ArrowDown');
    expect(await at()).toBe(titles[0]);
  });

  test('the page behind is held still and takes no pointer', async ({ page }) => {
    await page.goto('/#hardware');
    await page.waitForTimeout(500);
    await page.evaluate(() => window.scrollTo(0, 300));
    await page.click('.search-trigger');
    await page.waitForSelector('.search-dialog[open]');
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.scrollY), 'the page scrolled behind the sheet').toBe(300);
    // The results themselves must still move.
    await page.hover('.search-results');
    await page.mouse.wheel(0, 250);
    await page.waitForTimeout(250);
    expect(await page.evaluate(() => document.querySelector('.search-results').scrollTop))
      .toBeGreaterThan(0);
    // §30: one blurred surface at a time.
    const filtered = await page.evaluate(() => [...document.querySelectorAll('*')]
      .filter(e => getComputedStyle(e).backdropFilter !== 'none').length);
    expect(filtered, 'a second backdrop-filter is compositing behind the sheet').toBe(0);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => document.activeElement.className),
      'focus did not return to the search trigger').toContain('search-trigger');
    expect(await page.evaluate(() => window.scrollY), 'the page moved when search closed').toBe(300);

    // ...and the page must be scrollable by wheel again afterwards. Making the
    // dialog a flex column turned it into a scroll container, Chrome latched
    // the wheel to it, and the page could not be wheel-scrolled for the rest
    // of the session. Nothing about the layout revealed it.
    await page.mouse.move(700, 500);
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => window.scrollY),
      'the page cannot be scrolled by wheel after search closed').toBeGreaterThan(300);
  });

  test('the phone gets a sheet, not a shrunken modal', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openSearch(page);
    const m = await page.evaluate(() => {
      const d = document.querySelector('.search-dialog').getBoundingClientRect();
      const close = document.querySelector('.kbd-button');
      const cb = close.getBoundingClientRect();
      const input = document.querySelector('.search-input-row input');
      return {
        widthShare: d.width / window.innerWidth,
        closeLabel: close.innerText,
        closeHeight: cb.height,
        placeholderFits: input.scrollWidth <= input.clientWidth + 1,
        rowHeight: document.querySelector('.search-results > a').getBoundingClientRect().height,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    expect(m.widthShare, 'the phone got the desktop modal, shrunk').toBeGreaterThan(0.9);
    expect(m.closeLabel, 'the only way out is a keyboard hint').toBe('Close');
    expect(m.closeHeight).toBeGreaterThanOrEqual(36);
    expect(m.placeholderFits, 'the prompt is truncated').toBe(true);
    expect(m.rowHeight, 'the result rows are not comfortable targets').toBeGreaterThanOrEqual(44);
    expect(m.overflow).toBeLessThanOrEqual(0);
  });
});

test.describe('search under reduced motion', () => {
  test.use({ viewport: { width: 1440, height: 950 }, reducedMotion: 'reduce' });

  test('it resolves immediately and stays fully usable', async ({ page }) => {
    await page.goto('/#hardware');
    await page.waitForSelector('.search-trigger');
    await page.click('.search-trigger');
    await page.waitForTimeout(80);   // an animation would still be mid-flight
    const m = await page.evaluate(() => {
      const d = document.querySelector('.search-dialog');
      const cs = getComputedStyle(d);
      return { animation: cs.animationName, opacity: cs.opacity, transform: cs.transform,
               height: d.getBoundingClientRect().height };
    });
    expect(m.animation).toBe('none');
    expect(m.opacity).toBe('1');
    expect(m.transform).toBe('none');
    expect(m.height).toBeGreaterThan(200);
    await page.keyboard.press('ArrowDown');
    expect(await page.evaluate(() => document.activeElement.matches('.search-results > a'))).toBe(true);
  });
});

/* ==========================================================================
   Chapter 07 · H1 — the division field
   Art Direction II pilot. These assert the integrity contract, which is the
   whole claim of the figure: two quantities on one axis, neither corrupting
   the other's scale.
   ========================================================================== */

test.describe('the division field keeps its quantities separate', () => {
  const setD = (page, i) => page.evaluate(idx => {
    const el = document.querySelector('.df-scale-input');
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    set.call(el, String(idx));
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, i);

  const open = async page => {
    await page.goto('/#parallel');
    await page.waitForSelector('.division-field');
    await page.evaluate(() => document.querySelector('.division-field').scrollIntoView());
    await page.waitForTimeout(400);
  };

  test('width encodes nothing: blocks are identical at every device count', async ({ page }) => {
    await page.setViewportSize({ width: 1512, height: 950 });
    await open(page);
    const widths = [];
    for (const i of [0, 1, 2, 3, 4]) {
      await setD(page, i);
      await page.waitForTimeout(250);
      widths.push(await page.evaluate(() => {
        const b = [...document.querySelectorAll('.df-device')].map(e => e.getBoundingClientRect().width);
        return { count: b.length, distinct: new Set(b.map(w => w.toFixed(2))).size, w: +b[0].toFixed(2) };
      }));
    }
    // Within a state every block is the same width...
    for (const s of widths) expect(s.distinct, 'blocks differ in width within one state').toBe(1);
    // ...and across states the width does not move, so it cannot be read as a
    // quantity. If this fails, width has started encoding the data.
    const unique = new Set(widths.map(s => s.w));
    expect(unique.size, `block width changed across device counts: ${[...unique].join(', ')}`).toBe(1);
    expect(widths.map(s => s.count)).toEqual([1, 2, 4, 8, 16]);
  });

  test('the sync register is a count, and the count is D - 1', async ({ page }) => {
    await page.setViewportSize({ width: 1512, height: 950 });
    await open(page);
    for (const [i, devices] of [[0, 1], [1, 2], [2, 4], [3, 8], [4, 16]]) {
      await setD(page, i);
      await page.waitForTimeout(250);
      const m = await page.evaluate(() => ({
        blocks: document.querySelectorAll('.df-device').length,
        marks: document.querySelectorAll('.df-sync').length,
        // Each mark is numbered in house notation; the numbers are the evidence.
        numbers: [...document.querySelectorAll('.df-sync-n')].map(e => e.innerText.trim()),
        note: document.querySelector('.df-sync-register .df-register-note').innerText,
        tickSizes: new Set([...document.querySelectorAll('.df-sync-tick')]
          .map(e => `${e.getBoundingClientRect().width.toFixed(1)}x${e.getBoundingClientRect().height.toFixed(1)}`)).size,
      }));
      expect(m.blocks).toBe(devices);
      expect(m.marks, `sync marks are not D-1 at D=${devices}`).toBe(devices - 1);
      // The count is stated by the marks themselves, numbered 01..D-1.
      expect(m.numbers.length).toBe(devices - 1);
      if (devices > 1) {
        expect(m.numbers[0]).toBe('01');
        expect(m.numbers[m.numbers.length - 1]).toBe(String(devices - 1).padStart(2, '0'));
        expect(m.note).toContain(String(devices - 1));
      }
      // Every tick is identical: a count, never a length carrying a distance.
      if (m.marks > 1) expect(m.tickSizes, 'sync marks vary in size').toBe(1);
    }
  });

  test('the figures are placeMemory, not hand-written', async ({ page }) => {
    await page.setViewportSize({ width: 1512, height: 950 });
    await open(page);
    await setD(page, 3);
    await page.waitForTimeout(250);
    const read = () => page.evaluate(() => {
      const byLabel = want => [...document.querySelectorAll('.df-reading')]
        .find(r => r.querySelector('.df-reading-label')?.innerText.trim() === want)
        ?.querySelector('.df-reading-value')?.innerText.trim();
      return {
        perDevice: byLabel('PER DEVICE'),
        weights: byLabel('WEIGHTS / DEVICE'),
        cache: byLabel('CACHE / DEVICE'),
        copies: document.querySelectorAll('.df-copy').length,
        copyNote: document.querySelector('.df-copies-register .df-register-note').innerText,
        replicated: document.querySelector('.df-copies-register').dataset.replicated || null,
      };
    });
    const eight = await read();
    expect(eight.perDevice).toMatch(/^97\.4/);
    expect(eight.weights).toMatch(/^94\.5/);
    // One whole copy of the live cache at eight devices.
    expect(eight.copies).toBe(1);
    expect(eight.copyNote).toContain('23.6');
    expect(eight.replicated).toBe(null);

    await setD(page, 4);
    await page.waitForTimeout(250);
    const sixteen = await read();
    // Per-device halves while a second whole copy of the cache appears: the
    // chapter's event, and the reason the copies are a count rather than a bar.
    expect(sixteen.perDevice).toMatch(/^50\.2/);
    expect(sixteen.weights).toMatch(/^47\.2/);
    expect(sixteen.cache).toBe(eight.cache);   // the cache stopped dividing
    expect(sixteen.copies, 'replication is not shown as a second whole copy').toBe(2);
    expect(sixteen.copyNote).toContain('47.1');
    expect(sixteen.replicated).toBe('true');
  });

  test('the statement never states more than the model', async ({ page }) => {
    await page.setViewportSize({ width: 1512, height: 950 });
    await open(page);
    await setD(page, 3);
    await page.waitForTimeout(250);
    const m = await page.evaluate(() => ({
      statement: document.querySelector('.df-statement').innerText.replace(/\s+/g, ' ').trim(),
      status: document.querySelector('.df-status').innerText.replace(/\s+/g, ' ').trim(),
    }));
    expect(m.statement).toBe('Eight devices. Seven synchronisation points.');
    // Display type is read as the strongest assertion on the page, so the words
    // that would promote a modelled count into a measured duration are banned
    // from it. They remain allowed in body prose, where they are qualified.
    expect(m.statement).not.toMatch(/\b(wait|waits|latency|delay|slower)\b/i);
    expect(m.status).toContain('MODELLED');
    expect(m.status).toContain('not a measurement of time');
  });

  test('the capacity datum is a reference, never a control', async ({ page }) => {
    await page.setViewportSize({ width: 1512, height: 950 });
    await open(page);
    const m = await page.evaluate(() => {
      const d = document.querySelector('.df-datum');
      const scale = document.querySelector('.df-scale-input');
      return {
        datumTabbable: d.matches('a, button, input, [tabindex]'),
        datumPointer: getComputedStyle(d).pointerEvents,
        datumHidden: d.getAttribute('aria-hidden'),
        scaleIsRange: scale.type === 'range',
        scaleHeight: Math.round(scale.getBoundingClientRect().height),
        valuetext: scale.getAttribute('aria-valuetext'),
      };
    });
    // Focus is expressed through the scale's own current tick, not a container
    // outline. It still has to be unmistakable.
    await page.focus('.df-scale-input');
    await page.waitForTimeout(350);
    const focus = await page.evaluate(() => {
      const tick = document.querySelector('.df-stops .current .df-stop-tick');
      const t = getComputedStyle(tick);
      const idle = document.querySelector('.df-stops li:not(.current) .df-stop-tick');
      return {
        outline: getComputedStyle(document.activeElement).outlineStyle,
        colour: t.backgroundColor,
        grew: parseFloat(t.height) > parseFloat(getComputedStyle(idle).height) * 2,
        ring: t.boxShadow !== 'none',
      };
    });
    expect(focus.outline, 'a generic input outline came back').toBe('none');
    expect(focus.colour, 'the focused stop is not on the identity colour').toBe('rgb(60, 84, 64)');
    expect(focus.grew, 'the focused stop is not visibly distinct').toBe(true);
    expect(focus.ring).toBe(true);
    expect(m.datumTabbable).toBe(false);
    expect(m.datumPointer).toBe('none');
    expect(m.datumHidden).toBe('true');
    expect(m.scaleIsRange, 'the device scale lost its semantic control').toBe(true);
    expect(m.scaleHeight, 'the device scale is below the touch target floor').toBeGreaterThanOrEqual(44);
    expect(m.valuetext).toMatch(/modelled synchronisation points/);
  });

  test('no state at any width widens the page', async ({ page }) => {
    for (const width of [375, 430, 768, 1024, 1280, 1512, 1728, 1920, 2560]) {
      await page.setViewportSize({ width, height: 950 });
      await open(page);
      for (const i of [0, 2, 4]) {
        await setD(page, i);
        await page.waitForTimeout(200);
        const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(over, `the division field widened the page at ${width}px, state ${i}`).toBeLessThanOrEqual(0);
      }
    }
  });
});

test.describe('the division field under reduced motion', () => {
  test.use({ viewport: { width: 1512, height: 950 }, reducedMotion: 'reduce' });

  test('a new state is committed immediately', async ({ page }) => {
    await page.goto('/#parallel');
    await page.waitForSelector('.division-field');
    await page.evaluate(() => {
      document.querySelector('.division-field').scrollIntoView();
      const el = document.querySelector('.df-scale-input');
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      set.call(el, '4');
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForTimeout(50);   // an animation would still be mid-flight
    const m = await page.evaluate(() => ({
      marks: document.querySelectorAll('.df-sync').length,
      markOpacity: getComputedStyle(document.querySelector('.df-sync')).opacity,
      deviceAnimation: getComputedStyle(document.querySelector('.df-device')).animationName,
      bandTransition: getComputedStyle(document.querySelector('.df-weights')).transitionDuration,
    }));
    expect(m.marks).toBe(15);
    expect(m.markOpacity).toBe('1');
    expect(m.deviceAnimation).toBe('none');
    expect(m.bandTransition).toBe('0s');
  });
});

test.describe('a hero artifact may ask floating utilities to recede', () => {
  test.use({ viewport: { width: 430, height: 932 } });

  test('the on-this-page control retracts over the field and returns after it', async ({ page }) => {
    await page.goto('/#parallel');
    await page.waitForSelector('.division-field');
    const state = () => page.evaluate(() => {
      const fab = document.querySelector('.toc-fab');
      const cs = getComputedStyle(fab);
      return { scene: document.documentElement.dataset.heroScene || null, visibility: cs.visibility };
    });
    // Before: the utility is present and usable.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(600);
    expect(await state()).toEqual({ scene: null, visibility: 'visible' });

    // While the drawing owns the viewport it recedes — and being `visibility:
    // hidden` it cannot take keyboard focus while it is off the canvas.
    await page.evaluate(() => document.querySelector('.division-field').scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(800);
    expect(await state()).toEqual({ scene: 'division-field', visibility: 'hidden' });

    // After: restored. Section navigation is never permanently removed.
    await page.evaluate(() => window.scrollBy(0, 2400));
    await page.waitForTimeout(800);
    expect(await state()).toEqual({ scene: null, visibility: 'visible' });

    // Leaving the chapter clears it too, so no other page inherits the state.
    await page.goto('/#hardware');
    await page.waitForTimeout(800);
    expect(await page.evaluate(() => document.documentElement.dataset.heroScene || null)).toBe(null);
  });

  test('the rotated field composes: label above the datum, indices on the bands', async ({ page }) => {
    await page.goto('/#parallel');
    await page.waitForSelector('.division-field');
    await page.evaluate(() => document.querySelector('.df-statement').scrollIntoView({ block: 'start' }));
    await page.waitForTimeout(600);
    const m = await page.evaluate(() => {
      const q = s => document.querySelector(s).getBoundingClientRect();
      const bar = q('.topbar'), st = q('.df-statement');
      const datum = q('.df-datum'), label = q('.df-datum-label'), frame = q('.df-frame');
      const cells = [...document.querySelectorAll('.df-axis .df-axis-cell')].map(c => Math.round(c.getBoundingClientRect().top));
      const bands = [...document.querySelectorAll('.df-device')].map(c => Math.round(c.getBoundingClientRect().top));
      return {
        statementClipped: st.top < bar.bottom - 1,
        labelVisible: label.width > 0 && label.left >= 0,
        labelAboveFrame: label.bottom <= frame.top + 1,
        labelEndsOnDatum: Math.abs(label.right - datum.left) <= 6,
        indicesAligned: cells.length === bands.length && cells.every((t, i) => Math.abs(t - bands[i]) <= 1),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    // The fixed masthead measured 113px against a hard-coded 108px scroll pad.
    expect(m.statementClipped, 'the masthead clips the hero statement').toBe(false);
    // The capacity label was being swallowed by the frame's own clip.
    expect(m.labelVisible, 'the capacity label is not rendered').toBe(true);
    expect(m.labelAboveFrame).toBe(true);
    expect(m.labelEndsOnDatum, 'the label does not read as one dimension with its line').toBe(true);
    expect(m.indicesAligned, 'the device indices drifted off their bands').toBe(true);
    expect(m.overflow).toBeLessThanOrEqual(0);
  });
});
