"use client";

import { useState } from "react";

export function TicketTypeFields() {
  const [types, setTypes] = useState(["普通票"]);
  return <fieldset className="ticket-types"><legend>票种</legend>{types.map((name, index) => <div key={index}><input aria-label={`票种 ${index + 1}`} value={name} onChange={(event) => setTypes((old) => old.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} /><button type="button" disabled={types.length === 1} onClick={() => setTypes((old) => old.filter((_, itemIndex) => itemIndex !== index))}>移除</button></div>)}<button className="button" type="button" onClick={() => setTypes((old) => [...old, ""])}>添加票种</button><input type="hidden" name="ticketTypes" value={JSON.stringify(types)} /></fieldset>;
}
