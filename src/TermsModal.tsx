import React, { useState, useEffect } from 'react';

const TermsModal = () => {
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    // Verifica se o usuário já aceitou os termos anteriormente
    const hasAccepted = localStorage.getItem('criptoveu_accepted_terms');
    if (!hasAccepted) {
      setShowModal(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('criptoveu_accepted_terms', 'true');
    setShowModal(false);
  };

  if (!showModal) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#121212] border border-emerald-500/30 p-6 rounded-2xl max-w-lg w-full shadow-2xl">
        <h2 className="text-xl font-bold text-emerald-400 mb-4">Termos e Responsabilidade</h2>
        <div className="text-gray-300 text-sm space-y-3 mb-6 leading-relaxed">
          <p>Ao utilizar o <strong>CriptoVéu</strong>, você concorda com os seguintes pontos:</p>
          <ul className="list-disc ml-5 space-y-2">
            <li>A criptografia é feita localmente no seu navegador. <strong>Nenhum dado é enviado para nossos servidores.</strong></li>
            <li>O desenvolvedor não se responsabiliza pelo uso da ferramenta para finalidades ilícitas.</li>
            <li>A perda da senha implica na perda permanente dos dados, sem possibilidade de recuperação.</li>
          </ul>
        </div>
        <button 
          onClick={handleAccept}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-emerald-900/20"
        >
          Li e aceito os termos
        </button>
      </div>
    </div>
  );
};

export default TermsModal;
