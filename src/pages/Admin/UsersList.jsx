// ============================================
// 📁 UsersList.jsx - VERSION 100% CORRIGÉE
// ============================================
import React, { useState, useEffect, useContext } from "react";
import { AuthContext } from "../../context/AuthContext";

export default function UsersList() {
  const { user, token } = useContext(AuthContext);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Token manquant - Reconnectez-vous");
      return;
    }

    async function fetchUsers() {
      console.log("📡 [UsersList] Début chargement...");
      setLoading(true);
      setError("");
      
      try {
        const res = await fetch("/api/admin/users", {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        console.log("📡 [UsersList] Statut:", res.status);
        
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || "Erreur lors du chargement");
        }
        
        const data = await res.json();
        console.log("✅ [UsersList] Données reçues:", data);
        
        // ✅ CORRECTION 1 : Extraire users de l'objet response
        if (data.success && Array.isArray(data.users)) {
          console.log(`✅ [UsersList] ${data.users.length} utilisateurs trouvés`);
          setUsers(data.users);
        } else {
          console.error("❌ [UsersList] Format invalide:", data);
          throw new Error("Format de réponse invalide");
        }
        
      } catch (err) {
        console.error("❌ [UsersList] Erreur:", err);
        setError(err.message || "Erreur réseau");
      } finally {
        setLoading(false);
      }
    }

    fetchUsers();
  }, [token]);

  // ✅ Vérification du rôle admin
  if (!user) {
    return (
      <div style={{ textAlign: "center", padding: "40px" }}>
        <p>⏳ Chargement de l'utilisateur...</p>
      </div>
    );
  }

  if (user.role !== "admin" && user.role !== "superadmin" && user.role !== "moderator") {
    return (
      <div style={{ textAlign: "center", padding: "40px" }}>
        <p style={{ color: "red", fontSize: "18px", fontWeight: "bold" }}>
          ⛔ Accès refusé
        </p>
        <p style={{ color: "#666" }}>
          Vous devez être administrateur pour accéder à cette page
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: "auto", padding: 20 }}>
      <h2 style={{ 
        borderBottom: "3px solid #007bff", 
        paddingBottom: "10px",
        marginBottom: "20px" 
      }}>
        📋 Liste des utilisateurs
      </h2>
      
      {loading && (
        <div style={{ 
          textAlign: "center", 
          padding: "40px",
          backgroundColor: "#f8f9fa",
          borderRadius: "8px"
        }}>
          <p style={{ fontSize: "18px", color: "#007bff" }}>
            ⏳ Chargement en cours...
          </p>
        </div>
      )}
      
      {error && (
        <div style={{ 
          backgroundColor: "#ffebee", 
          border: "2px solid #f44336",
          padding: "16px",
          borderRadius: "8px",
          marginBottom: "20px"
        }}>
          <p style={{ color: "#d32f2f", margin: 0, fontWeight: "bold" }}>
            ❌ {error}
          </p>
        </div>
      )}
      
      {!loading && !error && (
        <>
          <div style={{ 
            marginBottom: "15px", 
            padding: "10px",
            backgroundColor: "#e3f2fd",
            borderRadius: "4px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <span style={{ color: "#1976d2", fontWeight: "bold" }}>
              Total : <strong style={{ fontSize: "20px" }}>{users.length}</strong> utilisateur(s)
            </span>
            <span style={{ 
              fontSize: "12px", 
              color: "#666",
              padding: "4px 8px",
              backgroundColor: "white",
              borderRadius: "4px"
            }}>
              Rôle: {user.role}
            </span>
          </div>
          
          <table 
            border="1" 
            cellPadding="12" 
            cellSpacing="0" 
            style={{ 
              width: "100%", 
              borderCollapse: "collapse",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              borderRadius: "8px",
              overflow: "hidden"
            }}
          >
            <thead style={{ backgroundColor: "#007bff", color: "white" }}>
              <tr>
                <th>Photo</th>
                <th>Nom complet</th>
                <th>Email</th>
                <th>Téléphone</th>
                <th>Rôle</th>
                <th>Premium</th>
                <th>Créé le</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ 
                    textAlign: "center", 
                    padding: "40px",
                    color: "#999"
                  }}>
                    Aucun utilisateur trouvé
                  </td>
                </tr>
              ) : (
                users.map(u => (
                  <tr key={u._id} style={{ 
                    borderBottom: "1px solid #dee2e6",
                    transition: "background-color 0.2s"
                  }}>
                    <td style={{ textAlign: "center" }}>
                      <img 
                        src={u.profilePhoto || '/default-avatar.png'} 
                        alt={u.fullName}
                        style={{ 
                          width: "45px", 
                          height: "45px", 
                          borderRadius: "50%",
                          objectFit: "cover",
                          border: "2px solid #dee2e6"
                        }}
                      />
                    </td>
                    {/* ✅ CORRECTION 2 : Utiliser fullName au lieu de username */}
                    <td style={{ fontWeight: "600" }}>
                      {u.fullName || "Anonyme"}
                      {u.isVerified && (
                        <span style={{ 
                          marginLeft: "8px",
                          color: "#007bff",
                          fontSize: "16px"
                        }}>✓</span>
                      )}
                    </td>
                    <td>{u.email || "—"}</td>
                    <td>{u.phone || "—"}</td>
                    <td>
                      <span style={{
                        padding: "4px 10px",
                        borderRadius: "12px",
                        backgroundColor: u.role === 'admin' ? '#e3f2fd' : '#f1f8e9',
                        color: u.role === 'admin' ? '#1976d2' : '#558b2f',
                        fontSize: "12px",
                        fontWeight: "bold",
                        textTransform: "uppercase"
                      }}>
                        {u.role}
                      </span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {u.isPremium ? (
                        <span style={{ fontSize: "18px" }}>👑</span>
                      ) : (
                        <span style={{ color: "#999" }}>—</span>
                      )}
                    </td>
                    <td>
                      {new Date(u.createdAt).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}