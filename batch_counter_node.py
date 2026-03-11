print("[Nova Batch Counter] batch_counter_node.py imported")

from aiohttp import web
from server import PromptServer
from typing import Optional

CURRENT_BATCH_INFO: dict[str, Optional[int]] = {
    "batch_size": None,
}


class BatchCounterInfo:
    CATEGORY = "utils"

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "latent": ("LATENT",),
            }
        }

    RETURN_TYPES = ("LATENT",)
    FUNCTION = "capture_batch_size"

    def capture_batch_size(self, latent):
        samples = latent["samples"]
        batch_size = int(samples.shape[0])

        CURRENT_BATCH_INFO["batch_size"] = batch_size

        print(f"[Nova Batch Counter] Captured batch size: {batch_size}")

        return (latent,)


routes = PromptServer.instance.routes


@routes.get("/nova_batch_counter/current")
async def get_current_batch_info(request):
    return web.json_response(CURRENT_BATCH_INFO)


NODE_CLASS_MAPPINGS = {
    "BatchCounterInfo": BatchCounterInfo,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "BatchCounterInfo": "Batch Counter Info",
}

print("[Nova Batch Counter] NODE_CLASS_MAPPINGS registered")
