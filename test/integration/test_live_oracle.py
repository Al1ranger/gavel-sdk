"""Opt-in local GenLayer deployment. Requires node and configured test account."""
import json
import os
from pathlib import Path

import pytest
from gltest import get_contract_factory
from gltest.assertions import tx_execution_succeeded

pytestmark = pytest.mark.skipif(os.getenv("GAVEL_LIVE_TEST") != "1", reason="Set GAVEL_LIVE_TEST=1 with a configured local GenLayer node and test account")


def test_live_scalar_observation():
    path = Path(__file__).resolve().parents[2] / "artifacts" / "oracles" / "berlin-temperature-20240701_scalaroracle.py"
    assert path.exists(), "Run npm run generate:examples first"
    factory = get_contract_factory(contract_file_path=path)
    contract = factory.deploy(args=[], wait_retries=10)
    # Factory checks deployment execution before instantiating the contract.
    receipt = contract.observe(args=[]).transact()
    assert tx_execution_succeeded(receipt)
    result = json.loads(contract.get_result(args=[]).call())
    assert result["kind"] == "SCALAR_OBSERVATION"
    assert result["longPayoutBps"] + result["shortPayoutBps"] == 10000
    assert result["evidence"][0]["available"] is True
    assert result["transfersExecuted"] is False
    # Successful execution is tested; accepted state is not claimed finalized.
