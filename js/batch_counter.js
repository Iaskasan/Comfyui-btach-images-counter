import { app } from "../../scripts/app.js";

app.registerExtension({
    name: "nova.batch.counter",

    async setup() {
        console.log("[Batch Counter] Extension loaded");

        const overlay = document.createElement("div");
        overlay.id = "nova-batch-counter-overlay";
        overlay.textContent = "Batch: -- / --";

        Object.assign(overlay.style, {
            position: "fixed",
            zIndex: "999999",
            padding: "10px 14px",
            background: "rgba(0, 0, 0, 0.78)",
            color: "#fff",
            fontSize: "16px",
            fontFamily: "Arial, sans-serif",
            borderRadius: "10px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
            pointerEvents: "none",
            userSelect: "none",
            display: "none",
        });

        document.body.appendChild(overlay);

        let currentBatchSize = null;
        let lastKnownIndex = null;
        let lastMainSrc = null;
        let wasViewerOpen = false;
        let pendingDirection = null; // "next" | "prev" | null

        async function fetchBatchInfo() {
            try {
                const response = await fetch("/nova_batch_counter/current");
                const data = await response.json();
                currentBatchSize = data.batch_size;
            } catch (error) {
                console.error("[Batch Counter] Failed to fetch batch info:", error);
            }
        }

        function isVisible(el) {
            if (!el) return false;

            const style = window.getComputedStyle(el);
            const rect = el.getBoundingClientRect();

            return (
                style.display !== "none" &&
                style.visibility !== "hidden" &&
                rect.width > 0 &&
                rect.height > 0
            );
        }

        function getVisibleImages() {
            return [...document.querySelectorAll("img")].filter((img) => {
                if (!isVisible(img)) return false;
                const rect = img.getBoundingClientRect();
                return rect.width >= 40 && rect.height >= 40;
            });
        }

        function getMainPreviewImage() {
            const images = getVisibleImages();

            let biggest = null;
            let biggestArea = 0;

            for (const img of images) {
                const rect = img.getBoundingClientRect();
                const area = rect.width * rect.height;

                if (area > biggestArea) {
                    biggestArea = area;
                    biggest = img;
                }
            }

            return biggest;
        }

        function extractImageNumber(url) {
            if (!url) return null;

            try {
                const parsed = new URL(url, window.location.origin);
                const filename = parsed.searchParams.get("filename");
                if (!filename) return null;

                const match = filename.match(/_(\d+)_\.[a-zA-Z0-9]+$/);
                if (!match) return null;

                return parseInt(match[1], 10);
            } catch (error) {
                return null;
            }
        }

        function getOpenedBatchThumbnails(mainImg) {
            if (!mainImg || !currentBatchSize) return [];

            let current = mainImg.parentElement;
            let depth = 0;
            let bestGroup = [];
            let bestDistance = Infinity;

            while (current && depth < 8) {
                if (isVisible(current)) {
                    const imgs = [...current.querySelectorAll("img")].filter((img) => {
                        if (!isVisible(img)) return false;
                        if (img === mainImg) return false;

                        const rect = img.getBoundingClientRect();
                        const mainRect = mainImg.getBoundingClientRect();

                        const imgArea = rect.width * rect.height;
                        const mainArea = mainRect.width * mainRect.height;

                        return imgArea > 0 && imgArea < mainArea * 0.5;
                    });

                    const groups = new Map();

                    for (const img of imgs) {
                        const rect = img.getBoundingClientRect();
                        const key = `${Math.round(rect.width / 10) * 10}x${Math.round(rect.height / 10) * 10}`;

                        if (!groups.has(key)) {
                            groups.set(key, []);
                        }
                        groups.get(key).push(img);
                    }

                    for (const [, group] of groups.entries()) {
                        const distance = Math.abs(group.length - currentBatchSize);

                        if (group.length >= 2 && distance < bestDistance) {
                            bestDistance = distance;
                            bestGroup = group;
                        }
                    }
                }

                current = current.parentElement;
                depth++;
            }

            if (!bestGroup.length) return [];

            return [...bestGroup].sort((a, b) => {
                const na = extractImageNumber(a.currentSrc || a.src);
                const nb = extractImageNumber(b.currentSrc || b.src);

                if (na === null && nb === null) return 0;
                if (na === null) return 1;
                if (nb === null) return -1;

                return na - nb;
            });
        }

        function detectCurrentIndex() {
            const mainImg = getMainPreviewImage();
            if (!mainImg || !currentBatchSize) return null;

            const thumbnails = getOpenedBatchThumbnails(mainImg);
            if (!thumbnails.length) return null;

            const mainNumber = extractImageNumber(mainImg.currentSrc || mainImg.src);
            if (mainNumber === null) return null;

            const index = thumbnails.findIndex((img) => {
                const thumbNumber = extractImageNumber(img.currentSrc || img.src);
                return thumbNumber === mainNumber;
            });

            if (index === -1) return null;

            return index + 1;
        }

        function isBatchViewerOpen() {
            if (!currentBatchSize) return false;

            const mainImg = getMainPreviewImage();
            if (!mainImg) return false;

            const thumbnails = getOpenedBatchThumbnails(mainImg);
            if (!thumbnails.length) return false;

            const validThumbNumbers = thumbnails
                .map((img) => extractImageNumber(img.currentSrc || img.src))
                .filter((n) => n !== null);

            const mainNumber = extractImageNumber(mainImg.currentSrc || mainImg.src);

            return (
                mainNumber !== null &&
                validThumbNumbers.length >= 2 &&
                Math.abs(validThumbNumbers.length - currentBatchSize) <= 2
            );
        }

        function clampIndex(index) {
            if (!currentBatchSize) return index;
            return Math.max(1, Math.min(index, currentBatchSize));
        }

        function positionOverlayOnImage() {
            const mainImg = getMainPreviewImage();
            if (!mainImg) return;

            const rect = mainImg.getBoundingClientRect();
            const margin = 12;

            // Top-right corner inside the displayed preview image
            overlay.style.left = `${rect.right - overlay.offsetWidth - margin}px`;
            overlay.style.top = `${rect.top + margin}px`;
        }

        function updateOverlay() {
            if (!currentBatchSize) {
                overlay.style.display = "none";
                return;
            }

            const viewerOpen = isBatchViewerOpen();
            const mainImg = getMainPreviewImage();
            const mainSrc = mainImg ? (mainImg.currentSrc || mainImg.src) : null;

            if (!viewerOpen) {
                wasViewerOpen = false;
                lastKnownIndex = null;
                lastMainSrc = null;
                overlay.style.display = "none";
                return;
            }

            overlay.style.display = "block";

            // Freshly opened batch viewer
            if (!wasViewerOpen) {
                wasViewerOpen = true;
                lastKnownIndex = 1;
                lastMainSrc = mainSrc;
                overlay.textContent = `Batch: 1 / ${currentBatchSize}`;
                positionOverlayOnImage();
                return;
            }

            const exactIndex = detectCurrentIndex();

            if (exactIndex !== null) {
                lastKnownIndex = exactIndex;
                lastMainSrc = mainSrc;
                overlay.textContent = `Batch: ${lastKnownIndex} / ${currentBatchSize}`;
                positionOverlayOnImage();
                return;
            }

            // Fallback: if image changed but exact match failed, move using last action
            if (mainSrc && lastMainSrc && mainSrc !== lastMainSrc && lastKnownIndex !== null) {
                if (pendingDirection === "next") {
                    lastKnownIndex = clampIndex(lastKnownIndex + 1);
                } else if (pendingDirection === "prev") {
                    lastKnownIndex = clampIndex(lastKnownIndex - 1);
                }

                lastMainSrc = mainSrc;
                overlay.textContent = `Batch: ${lastKnownIndex} / ${currentBatchSize}`;
                positionOverlayOnImage();
                return;
            }

            // Keep last valid index instead of hiding or resetting
            if (lastKnownIndex !== null) {
                overlay.textContent = `Batch: ${lastKnownIndex} / ${currentBatchSize}`;
                positionOverlayOnImage();
                return;
            }

            overlay.style.display = "none";
        }

        await fetchBatchInfo();
        updateOverlay();

        window.addEventListener("click", () => {
            const viewerWasOpen = isBatchViewerOpen();
            pendingDirection = viewerWasOpen ? "next" : null;

            setTimeout(() => {
                updateOverlay();
                pendingDirection = null;
            }, 100);
        }, true);

        window.addEventListener("keydown", (event) => {
            if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                pendingDirection = "prev";
            } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                pendingDirection = "next";
            } else {
                pendingDirection = null;
            }

            setTimeout(() => {
                updateOverlay();
                pendingDirection = null;
            }, 100);
        });

        window.addEventListener("wheel", (event) => {
            const viewerWasOpen = isBatchViewerOpen();
            if (!viewerWasOpen) {
                pendingDirection = null;
            } else {
                pendingDirection = event.deltaY > 0 ? "next" : "prev";
            }

            setTimeout(() => {
                updateOverlay();
                pendingDirection = null;
            }, 100);
        }, { passive: true });

        window.addEventListener("resize", () => {
            if (overlay.style.display !== "none") {
                positionOverlayOnImage();
            }
        });

        window.addEventListener("scroll", () => {
            if (overlay.style.display !== "none") {
                positionOverlayOnImage();
            }
        }, true);

        setInterval(async () => {
            await fetchBatchInfo();
            updateOverlay();
        }, 1000);
    },
});