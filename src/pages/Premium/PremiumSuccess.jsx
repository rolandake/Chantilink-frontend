// src/pages/PremiumSuccess.jsx
export default function PremiumSuccess() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-black text-white">ÉLITE ACTIVÉ</h1>
        <p className="text-2xl text-yellow-400 mt-4">Bienvenue dans le 1%</p>
        <button onClick={() => window.location.href = "/"} className="mt-8 px-8 py-4 bg-yellow-400 text-black font-bold rounded-full">
          Retour à l'accueil
        </button>
      </div>
    </div>
  );
}