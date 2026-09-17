import { test, expect } from '@playwright/test';

/**
 * The Phase 8 quality gate, as a suite.
 *
 * Every assertion here corresponds to a line of the gate in
 * `fashion_engineering_frontend_skill/RESPONSIVE_REFACTOR_TASK.md` or to a rule
 * from the modules it points at. They were all verified by hand during the
 * refactor; encoding them means a later change cannot quietly undo one.
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
