import React, { useState } from 'react';
import { Shield, Zap, Plus } from 'lucide-react';

interface HeaderProps {
  onQuickConnect: (target: string) => void;
  onOpenAddModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onQuickConnect, onOpenAddModal }) => {
  const [quickInput, setQuickInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickInput.trim()) {
      onQuickConnect(quickInput.trim());
      setQuickInput('');
    }
  };

  return (
    <header className="app-header">
      <div className="brand-section">
        <div className="brand-icon">
          <Shield size={20} />
        </div>
        <span className="brand-title">Termius Desktop</span>
      </div>

      {/* Quick Connect Bar */}
      <form className="quick-connect-form" onSubmit={handleSubmit}>
        <Zap size={16} color="#06b6d4" />
        <input
          type="text"
          className="quick-connect-input"
          placeholder="Quick SSH Connect (e.g. 46.225.58.185 or 192.168.1.50:23)"
          value={quickInput}
          onChange={(e) => setQuickInput(e.target.value)}
        />
        <button type="submit" className="quick-connect-btn">
          Connect
        </button>
      </form>

      <button className="add-host-btn" onClick={onOpenAddModal}>
        <Plus size={16} /> New Host
      </button>
    </header>
  );
};
