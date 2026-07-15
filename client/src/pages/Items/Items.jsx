import { useState, useEffect, useRef } from "react";

function Item({ id, name, stock }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [itemStock, setItemStock] = useState(stock);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const claimIdRef = useRef(null);
  const expiresAtRef = useRef(null);
  const expireTimeoutRef = useRef(null);
  const tickRef = useRef(null);

  function stopTimers() {
    clearTimeout(expireTimeoutRef.current);
    clearInterval(tickRef.current);
  }

  function revertClaim() {
    if (!claimIdRef.current) return;
    stopTimers();
    claimIdRef.current = null;
    expiresAtRef.current = null;
    setShowConfirm(false);
    setSecondsLeft(null);
    setItemStock(prev => prev + 1);
  }

  function scheduleExpiry(expiresAt) {
    const msUntilExpiry = Math.max(0, expiresAt - Date.now());
    expireTimeoutRef.current = setTimeout(checkStatus, msUntilExpiry + 250);

    tickRef.current = setInterval(() => {
      const secs = Math.max(0, Math.round((expiresAtRef.current - Date.now()) / 1000));
      setSecondsLeft(secs);
      if (secs <= 0) clearInterval(tickRef.current);
    }, 1000);
  }

  async function checkStatus() {
    if (!claimIdRef.current) return;
    try {
      const res = await fetch(`/api/items/claim/${claimIdRef.current}/status`);
      if (!res.ok) return;
      const data = await res.json();

      if (data.status === "expired") {
        revertClaim();
      } else if (data.status === "confirmed") {
        stopTimers();
        claimIdRef.current = null;
        setShowConfirm(false);
        setSecondsLeft(null);
      }
    } catch (err) {
      console.log(err);
    }
  }

  async function handleClaimClick() {
    setIsClaiming(true);
    setErrorMsg(null);
    const requestId = crypto.randomUUID();
    try {
      const response = await fetch(`/api/items/${id}/claim`, {
        method: "POST",
        headers: { "x-request-id": requestId },
      });
      const data = await response.json();

      if (!response.ok) {
        switch (data.code) {
          case "OUT_OF_STOCK":
            setErrorMsg("Out of stock — try another item.");
            break;
          case "DUPLICATE_REQUEST":
            setErrorMsg("That claim was already submitted.");
            break;
          default:
            setErrorMsg("Something went wrong. Try again.");
        }
        return;
      }

      claimIdRef.current = data.claimId;
      const expiresAt = new Date(data.expiresAt).getTime();
      expiresAtRef.current = expiresAt;
      setItemStock(prev => prev - 1);
      setShowConfirm(true);
      scheduleExpiry(expiresAt);
    } catch (error) {
      setErrorMsg("Network error — try again.");
    } finally {
      setIsClaiming(false);
    }
  }

  async function handleConfirmClick() {
    setIsConfirming(true);
    setErrorMsg(null);
    try {
      const response = await fetch(`/api/items/claim/${claimIdRef.current}/confirm`, {
        method: "PATCH",
      });
      const data = await response.json();

      if (!response.ok) {
        switch (data.code) {
          case "EXPIRED":
            revertClaim();
            return;
          case "ALREADY_RESOLVED":
            checkStatus();
            return;
          default:
            setErrorMsg("Failed to confirm. Try again.");
            return;
        }
      }

      stopTimers();
      claimIdRef.current = null;
      setShowConfirm(false);
      setSecondsLeft(null);
      alert("confirmed!");
    } catch (error) {
      setErrorMsg("Network error — try again.");
    } finally {
      setIsConfirming(false);
    }
  }

  useEffect(() => stopTimers, []);

  return (
    <div style={{ marginBottom: "0.75rem" }}>
      <p>{name} - stock({itemStock})</p>

      {!showConfirm ? (
        <button onClick={handleClaimClick} disabled={isClaiming || itemStock <= 0}>
          {isClaiming ? "Claiming..." : itemStock <= 0 ? "Out of stock" : "Claim"}
        </button>
      ) : (
        <div>
          <button onClick={handleConfirmClick} disabled={isConfirming}>
            {isConfirming ? "Confirming..." : "Confirm claim?"}
          </button>
          {secondsLeft !== null && <span> ({secondsLeft}s left)</span>}
        </div>
      )}

      {errorMsg && <p style={{ color: "red", fontSize: "0.9rem" }}>{errorMsg}</p>}
    </div>
  );
}

export default function Items() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchItems() {
      try {
        const response = await fetch("/api/items");
        if (!response.ok) throw new Error("Failed to fetch items");
        const data = await response.json();
        setItems(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchItems();
  }, []);

  if (loading) return <p>Loading items...</p>;

  return (
    <div>
      <h1>Items:</h1>
      <ul>
        {items.map(item => (
          <Item key={item._id} id={item._id} name={item.name} stock={item.stock} />
        ))}
      </ul>
    </div>
  );
}