import test from "node:test";
import assert from "node:assert/strict";
import { checkGeometry, checkRaster } from "../tools/control-centre-checker/assertions.mjs";
const allWidths = sample => [1440, 1280, 390, 320].map(width => ({ ...structuredClone(sample), width }));

test("checker fails closed for blank, transparent or missing-highlight screenshots", () => {
  const good = { width: 1440, height: 1100, dark: .1, teal: .15, alpha: 1 };
  assert.doesNotThrow(() => checkRaster(good));
  for (const patch of [{ dark: 0 }, { alpha: 0 }, { teal: 0 }, { width: 200 }]) assert.throws(() => checkRaster({ ...good, ...patch }));
});
test("checker rejects missing metric rows and horizontal overflow", () => {
  assert.throws(() => checkGeometry([]), /Missing geometry/);
  assert.throws(() => checkGeometry([{ width: 1440 }]), /Missing required/);
  assert.throws(() => checkGeometry(allWidths({ overflow: true })), /overflow/);
  assert.throws(() => checkGeometry(allWidths({ overflow: false, rows: [] })), /Three main rows/);
});
test("checker catches semantic, alignment, marker and clipping regressions", () => {
  const rows = Array.from({ length: 3 }, () => Array.from({ length: 4 }, (_, i) => ({ x: 200 + i * 150, y: 100, width: 140 })));
  const good = { width: 1440, overflow: false, rows, slider: { center: 500 }, metrics: { center: 500 }, dates: { center: 500, left: 300, centerY: 240 }, changeGoals: { role: "A", right: 200, centerY: 240 }, marker: { horizontal: true, aboveSlider: true, labelInside: true, positionError: 0 }, clipped: [], positionOverlaps: [], positionClipped: [], wrappedValues: [], contrast: [{ label: "Metric", ratio: 8 }] };
  assert.doesNotThrow(() => checkGeometry(allWidths(good)));
  for (const patch of [
    { changeGoals: { ...good.changeGoals, role: "BUTTON" } },
    { changeGoals: { ...good.changeGoals, centerY: 220 } },
    { dates: { ...good.dates, center: 510 } },
    { slider: { center: 510 } },
    { marker: { ...good.marker, positionError: 5 } },
    { marker: { ...good.marker, labelInside: false } },
    { clipped: ["Known net position"] },
    { positionOverlaps: ["Known records only"] },
    { positionClipped: ["$60,000/year"] },
    { wrappedValues: ["$20,077,923.62"] },
    { contrast: [{ label: "Link", ratio: 3.8 }] },
  ]) assert.throws(() => checkGeometry(allWidths({ ...good, ...patch })));
});
