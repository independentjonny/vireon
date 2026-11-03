import assert from "node:assert/strict";

export function checkGeometry(samples) {
  assert.ok(Array.isArray(samples) && samples.length > 0, "Missing geometry evidence");
  const widths = new Set(samples.map(sample => sample.width));
  assert.ok([1440, 1280, 390, 320].every(width => widths.has(width)), "Missing required desktop/mobile geometry samples");
  for (const sample of samples) {
    assert.equal(sample.overflow, false, `${sample.width}px: horizontal overflow`);
    assert.equal(sample.rows.length, 3, "Three main rows required");
    for (const row of sample.rows) {
      assert.equal(row.length, 4, "Four metrics required");
      if (sample.width >= 1024) row.forEach((card, i) => {
        assert.ok(Math.abs(card.x - sample.rows[0][i].x) <= 1, "Metric columns misaligned");
        assert.ok(Math.abs(card.width - sample.rows[0][i].width) <= 1, "Metric widths differ");
        assert.ok(Math.abs(card.y - row[0].y) <= 1, "Metric headings not aligned");
      });
    }
    assert.ok(Math.abs(sample.slider.center - sample.metrics.center) <= 1, "Slider is not centred under metrics");
    assert.ok(Math.abs(sample.dates.center - sample.metrics.center) <= 1, "Date pair is not centred under metrics");
    if (sample.width >= 1024) {
      assert.equal(sample.changeGoals.role, "A", "Change goals must be a link");
      assert.ok(sample.changeGoals.right < sample.dates.left, "Change goals must be left of date pair");
      assert.ok(Math.abs(sample.changeGoals.centerY - sample.dates.centerY) <= 2, "Change goals and date pair must share a row");
    }
    assert.ok(sample.marker.horizontal && sample.marker.aboveSlider, "Retirement mark must be horizontal and above slider");
    assert.ok(sample.marker.labelInside, "Retirement label clipped");
    assert.ok(sample.marker.positionError <= 1, "Retirement mark does not match its date");
    assert.deepEqual(sample.clipped, [], "Primary text or controls clipped");
    assert.deepEqual(sample.positionOverlaps, [], "Financial Position header groups overlap");
    assert.deepEqual(sample.positionClipped, [], "Financial Position text extends beyond its card");
    assert.deepEqual(sample.wrappedValues, [], "Currency values must not wrap their digits or cents");
    assert.ok(sample.contrast?.length > 0, "Missing text contrast evidence");
    for (const item of sample.contrast) assert.ok(item.ratio >= 4.5, `Low text contrast: ${item.label} (${item.ratio.toFixed(2)}:1)`);
  }
}

export function checkRaster({ width, height, dark, teal, alpha }) {
  assert.ok(width >= 300 && height >= 500, "Screenshot too small");
  assert.ok(alpha > .99, "Screenshot transparent");
  assert.ok(dark > .005 && dark < .6, "Screenshot blank or unreadable");
  assert.ok(teal > .01, "Take Control highlight missing from rendered pixels");
}
