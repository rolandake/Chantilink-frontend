import React from "react";

export default function PrivacyPolicy() {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6 text-gray-800 dark:text-gray-200">
      <h1 className="text-3xl font-bold text-orange-500">
        Politique de confidentialité – Chantilink
      </h1>

      <p className="text-sm text-gray-500 dark:text-gray-400">
        Dernière mise à jour : 05 janvier 2026
      </p>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">1. Introduction</h2>
        <p>
          Chantilink respecte la vie privée de ses utilisateurs. Cette politique
          explique comment nous collectons, utilisons et protégeons vos données
          personnelles lors de l’utilisation de l’application.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">2. Données collectées</h2>
        <ul className="list-disc list-inside space-y-1">
          <li>Nom et prénom</li>
          <li>Numéro de téléphone</li>
          <li>Adresse e-mail</li>
          <li>Photo de profil (facultative)</li>
          <li>Messages, images et vidéos échangés</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">3. Utilisation des données</h2>
        <p>
          Les données sont utilisées uniquement pour assurer le bon
          fonctionnement de Chantilink : messagerie, partage de médias,
          sécurité et amélioration de l’application.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">4. Partage des données</h2>
        <p>
          Chantilink ne vend ni ne partage vos données à des tiers à des fins
          commerciales.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">5. Sécurité</h2>
        <p>
          Nous mettons en œuvre des mesures techniques et organisationnelles
          pour protéger vos données contre tout accès non autorisé.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">6. Droits des utilisateurs</h2>
        <p>
          Vous pouvez demander l’accès, la modification ou la suppression de
          vos données à tout moment.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">7. Contact</h2>
        <p>
          📧 Contact : <strong>Chantilink@gmail.com</strong>
        </p>
      </section>
    </div>
  );
}
