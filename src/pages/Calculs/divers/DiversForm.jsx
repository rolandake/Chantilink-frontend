import React from "react";
import Divers from "../batiment/forms/Divers.jsx";

export default function DiversForm({ currency = "XOF" }) {
  const [total, setTotal] = React.useState(0);
  const [quantites, setQuantites] = React.useState({});

  return (
    <Divers
      currency={currency}
      onTotalChange={(val) => setTotal(val)}
      onCostChange={(val) => setTotal(val)}
      onMateriauxChange={(mats) => setQuantites(mats)}
    />
  );
}