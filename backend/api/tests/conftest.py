import pytest


@pytest.fixture(autouse=True)
def isolated_services(settings, monkeypatch):
    # OTP mechanics tests run in explicit development mode. Production-policy
    # tests override DEBUG themselves and mock delivery at the provider boundary.
    settings.DEBUG = True
    settings.OTP_EXPOSE_DEBUG_CODE = True
    settings.CHANNEL_LAYERS = {'default': {'BACKEND': 'channels.layers.InMemoryChannelLayer'}}
    import requests
    def blocked(*args, **kwargs):
        raise AssertionError('External HTTP is disabled in the test suite; mock the provider.')
    monkeypatch.setattr(requests.sessions.Session, 'request', blocked)
