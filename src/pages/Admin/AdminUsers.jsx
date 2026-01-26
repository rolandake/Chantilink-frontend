// ============================================
// 📁 AdminUsers.jsx - VERSION 100% CORRIGÉE
// ============================================
import React, { useEffect, useState, useContext } from "react";
import { AuthContext } from "../../context/AuthContext";

export default function AdminUsers() {
  const { token } = useContext(AuthContext);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function fetchUsers() {
    console.log("📡 [AdminUsers] Début chargement...");
    setLoading(true);
    setError("");
    
    try {
      const res = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      console.log("📡 [AdminUsers] Statut:", res.status);
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Erreur récupération utilisateurs");
      }
      
      const data = await res.json();
      console.log("✅ [AdminUsers] Données reçues:", data);
      
      // ✅ CORRECTION 1 : Extraire users de l'objet response
      if (data.success && Array.isArray(data.users)) {
        console.log(`✅ [AdminUsers] ${data.users.length} utilisateurs trouvés`);
        setUsers(data.users);
      } else {
        console.error("❌ [AdminUsers] Format invalide:", data);
        throw new Error("Format de réponse invalide");
      }
      
    } catch (err) {
      console.error("❌ [AdminUsers] Erreur:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function deleteUser(id) {
    if (!window.confirm("Confirmer la suppression de cet utilisateur ?")) return;
    
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Erreur suppression");
      }
      
      alert("Utilisateur supprimé avec succès");
      await fetchUsers(); // Recharger la liste
      
    } catch (err) {
      console.error("❌ [AdminUsers] Erreur suppression:", err);
      alert(err.message);
    }
  }

  useEffect(() => {
    if (token) {
      fetchUsers();
    }
  }, [token]);

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "40px" }}>
        <p>⏳ Chargement des utilisateurs...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div style={{ textAlign: "center", padding: "40px" }}>
        <p style={{ color: "red" }}>❌ {error}</p>
        <button onClick={fetchUsers} style={{ marginTop: "10px" }}>
          🔄 Réessayer
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "1200px", margin: "auto", padding: "20px" }}>
      <div style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center",
        marginBottom: "20px" 
      }}>
        <h2>Administration des utilisateurs ({users.length})</h2>
        <button 
          onClick={fetchUsers} 
          style={{ 
            padding: "8px 16px",
            backgroundColor: "#007bff",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer"
          }}
        >
          🔄 Actualiser
        </button>
      </div>

      {users.length === 0 ? (
        <p style={{ textAlign: "center", color: "#666", padding: "40px" }}>
          Aucun utilisateur trouvé
        </p>
      ) : (
        <table 
          border="1" 
          cellPadding="12" 
          cellSpacing="0" 
          style={{ 
            width: "100%", 
            borderCollapse: "collapse",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
          }}
        >
          <thead style={{ backgroundColor: "#f8f9fa" }}>
            <tr>
              <th>Photo</th>
              <th>Nom complet</th>
              <th>Email</th>
              <th>Téléphone</th>
              <th>Rôle</th>
              <th>Premium</th>
              <th>Banni</th>
              <th>Inscrit le</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u._id} style={{ borderBottom: "1px solid #dee2e6" }}>
                <td style={{ textAlign: "center" }}>
                  <img 
                    src={u.profilePhoto || '/default-avatar.png'} 
                    alt={u.fullName}
                    style={{ 
                      width: "50px", 
                      height: "50px", 
                      borderRadius: "50%",
                      objectFit: "cover",
                      border: "2px solid #dee2e6"
                    }}
                  />
                </td>
                {/* ✅ CORRECTION 2 : Utiliser fullName au lieu de username */}
                <td style={{ fontWeight: "600" }}>{u.fullName || "Anonyme"}</td>
                <td>{u.email}</td>
                <td>{u.phone || "—"}</td>
                <td>
                  <span style={{ 
                    padding: "4px 12px", 
                    borderRadius: "12px",
                    backgroundColor: u.role === 'admin' ? '#dc3545' : '#28a745',
                    color: 'white',
                    fontSize: "12px",
                    fontWeight: "bold"
                  }}>
                    {u.role}
                  </span>
                </td>
                <td style={{ textAlign: "center" }}>
                  {u.isPremium ? "👑 Oui" : "—"}
                </td>
                <td style={{ textAlign: "center" }}>
                  {u.isBanned ? "🚫 Oui" : "✅ Non"}
                </td>
                <td>
                  {new Date(u.createdAt).toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                  })}
                </td>
                <td style={{ textAlign: "center" }}>
                  <button 
                    onClick={() => deleteUser(u._id)}
                    style={{ 
                      backgroundColor: "#dc3545", 
                      color: "white",
                      border: "none",
                      padding: "8px 16px",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "12px",
                      fontWeight: "bold"
                    }}
                  >
                    🗑️ Supprimer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}