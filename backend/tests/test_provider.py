from app.providers.mock_provider import MockProvider


def test_mock_provider_is_deterministic():
    provider = MockProvider()

    ticket = {
        "id": "tkt_test",
        "subject": "Billing question",
        "body": "Why was I charged?",
        "from_email": "customer@example.com",
    }

    first = provider.extract(ticket)
    second = provider.extract(ticket)

    assert first == second


def test_mock_provider_can_return_invalid_output():
    provider = MockProvider()

    ticket = {
        "id": "tkt_0030",
        "subject": "Billing question",
        "body": "Something is wrong",
        "from_email": "customer@example.com",
    }

    result = provider.extract(ticket, attempt=1)

    assert result["record"]["severity"] == "urgent"


def test_mock_provider_retry_can_return_valid_output():
    provider = MockProvider()

    ticket = {
        "id": "tkt_0030",
        "subject": "Billing question",
        "body": "Something is wrong",
        "from_email": "customer@example.com",
    }

    result = provider.extract(ticket, attempt=2)

    assert result["record"]["severity"] == "medium"
    assert "severity" in result["uncertain_fields"]


def test_mock_provider_does_not_invent_product():
    provider = MockProvider()

    ticket = {
        "id": "tkt_test",
        "subject": "I need help",
        "body": "Can someone help me with this issue?",
        "from_email": "customer@example.com",
    }

    result = provider.extract(ticket)

    assert "product" in result["uncertain_fields"]
    assert "product" in result["uncertain_fields"]


def test_mock_provider_does_not_invent_severity():
    provider = MockProvider()

    ticket = {
        "id": "tkt_test",
        "subject": "Question",
        "body": "I have a question about my account.",
        "from_email": "customer@example.com",
    }

    result = provider.extract(ticket)

    assert result["record"]["severity"] == "medium"
    assert "severity" in result["uncertain_fields"]
    assert "severity" in result["uncertain_fields"]