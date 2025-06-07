import asyncio


def run_async(coro):
    """
    Helper function to run async code in sync context.

    Args:
        coro: Coroutine to run

    Returns:
        The result of the coroutine
    """
    return asyncio.get_event_loop().run_until_complete(coro)
