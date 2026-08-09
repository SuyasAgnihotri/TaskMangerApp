from rest_framework.views import exception_handler


def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is not None:
        return response

    return None


def api_response(data=None, error=None, status=200):
    from rest_framework.response import Response

    payload = {"data": data, "error": error}
    return Response(payload, status=status)
