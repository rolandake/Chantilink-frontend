import React from "react";

export default function PrivacyAndSafetyPolicy() {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6 text-gray-800 dark:text-gray-200">
      <h1 className="text-3xl font-bold text-orange-500">
        Politique de confidentialité & Normes de sécurité – Chantilink
      </h1>

      <p className="text-sm text-gray-500 dark:text-gray-400">
        Dernière mise à jour : 19 mars 2026
      </p>

      {/* ---------------- PRIVACY POLICY ---------------- */}
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
        <h2 className="text-xl font-semibold">7. Contact et suppression de compte</h2>
        <p>
          📧 Pour toute question concernant vos données ou pour demander la
          suppression de votre compte Chantilink, envoyez un email à :{" "}
          <strong>
            <a href="mailto:akeroland63@gmail.com">akeroland63@gmail.com</a>
          </strong>.
        </p>
        <p>
          Dans votre email, indiquez clairement l’adresse email ou le numéro de
          téléphone associé à votre compte. Toutes les données seront supprimées
          dans un délai de 30 jours après réception de la demande.
        </p>
      </section>

      {/* ---------------- SAFETY POLICY ---------------- */}
      <section className="pt-6 border-t border-gray-300 dark:border-gray-700 space-y-3">
        <h2 className="text-2xl font-bold text-red-500">
          Normes de sécurité des enfants
        </h2>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">8. Engagement</h2>
        <p>
          Chantilink s’engage à protéger tous ses utilisateurs, en particulier
          les mineurs, contre toute forme d’abus, d’exploitation ou de contenu
          inapproprié.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">9. Contenu interdit</h2>
        <ul className="list-disc list-inside space-y-1">
          <li>
            Tout contenu impliquant l’exploitation sexuelle des enfants est
            strictement interdit
          </li>
          <li>Le harcèlement ou comportement dangereux envers les mineurs</li>
          <li>Le partage de contenu illégal ou inapproprié</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">10. Signalement</h2>
        <p>
          Les utilisateurs peuvent signaler tout contenu ou comportement suspect
          directement dans l’application.
        </p>
        <p>
          Vous pouvez également nous contacter à :
          <strong> akeroland63@gmail.com</strong>
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">11. Modération</h2>
        <p>
          Chantilink applique une modération active. Tout contenu signalé est
          examiné et supprimé si nécessaire.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">12. Conformité légale</h2>
        <p>
          Chantilink respecte toutes les lois applicables en matière de
          protection de l’enfance et coopère avec les autorités compétentes en
          cas de violation.
        </p>
      </section>
    </div>
  );
}
