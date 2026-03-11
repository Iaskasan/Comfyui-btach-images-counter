# ComfyUI Batch Image Counter

A small **ComfyUI extension** that displays the current image index when browsing a generated batch.

When opening a batch preview, a counter appears in the **top-right corner of the image**, showing:

    3 / 12

This helps keep track of your position when reviewing large batches of generated images.

---

# Features

- Displays the **current image index / batch size**
- Counter appears **only when a batch preview is open**
- Automatically resets when opening a new batch
- Works with **any image size**
- Counter stays aligned to the **top-right corner of the preview image**
- Does **not modify generated images**
- Lightweight and fully local (no internet access required)

---

# How It Works

The extension combines a **backend node** and a **frontend UI overlay**.

## Backend (Python Node)

A custom node is inserted into the workflow between:

    Empty Latent Image → Batch Counter Node → KSampler

The node reads the **latent batch size** and exposes it through a local API endpoint.

Example:

    batch_size = latent["samples"].shape[0]

The batch size is then accessible from the frontend via:

    /nova_batch_counter/current

---

## Frontend (JavaScript Extension)

The frontend script:

1. Detects when a **batch preview viewer** is open  
2. Identifies the **main preview image**  
3. Finds the batch thumbnails  
4. Determines the **current image index**  
5. Displays the counter as an overlay positioned relative to the preview image  

The overlay position is dynamically computed using:

    mainImg.getBoundingClientRect()

This allows the counter to remain correctly positioned regardless of image resolution or UI layout.

---

# Installation

Clone or download the repository into your ComfyUI custom nodes folder:

    ComfyUI/custom_nodes/comfyui-batch-image-counter

Example folder structure:

    ComfyUI/
     ├── custom_nodes/
     │    └── comfyui-batch-image-counter/
     │         ├── __init__.py
     │         ├── batch_counter_node.py
     │         └── js/
     │             └── batch_counter.js

Restart **ComfyUI** after installation.

---

# Usage

Add the **Batch Counter Info** node to your workflow between:

    Empty Latent Image → Batch Counter Info → KSampler

Example workflow section:

    Empty Latent Image
            ↓
    Batch Counter Info
            ↓
    KSampler

Generate a batch of images, then open the preview.

The counter will appear automatically in the **top-right corner of the image**.

---

# Example

If a batch of **12 images** is generated, the overlay will show:

    1 / 12
    2 / 12
    3 / 12
    ...
    12 / 12

as you browse through the images.

---

# Limitations

- Designed primarily for **sequential browsing** of batch images
- If jumping directly between thumbnails, the counter may take a moment to resync

---

# Why This Exists

When generating large batches (20–100+ images), it's easy to lose track of which image you're currently reviewing.

This extension provides a simple visual indicator so you always know **where you are in the batch**.

---

# License

MIT License
