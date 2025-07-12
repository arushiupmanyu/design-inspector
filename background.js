chrome.commands.onCommand.addListener((command) => {
  if (command === "run-inspector") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        files: ["content.js"]
      });
    });
  }
});

function getProminentColors() {
  const container = getMainContentContainer();
  const elements = Array.from(container.querySelectorAll("*"))
    .filter(el => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return (
        el.offsetWidth > 0 &&
        el.offsetHeight > 0 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0' &&
        rect.width > 10 && rect.height > 10
      );
    });

  const colorAreas = {};
  const textColorCounts = {};
  elements.forEach(el => {
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const area = rect.width * rect.height;

    // Background color
    if (style.backgroundColor && style.backgroundColor.startsWith("rgb")) {
      const hex = rgbToHex(style.backgroundColor);
      colorAreas[hex] = (colorAreas[hex] || 0) + area;
    }
    // Text color
    if (style.color && style.color.startsWith("rgb")) {
      const hex = rgbToHex(style.color);
      colorAreas[hex] = (colorAreas[hex] || 0) + area / 2;
      textColorCounts[hex] = (textColorCounts[hex] || 0) + 1;
    }
  });

  // Top 3 by area
  const topByArea = Object.entries(colorAreas)
    .sort((a, b) => b[1] - a[1])
    .map(([hex]) => hex);

  // Top 2 text colors by count, not already in area list
  const topTextColors = Object.entries(textColorCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([hex]) => hex)
    .filter(hex => !topByArea.includes(hex))
    .slice(0, 2);

  // Combine and deduplicate
  return [...topByArea.slice(0, 3), ...topTextColors];
}
