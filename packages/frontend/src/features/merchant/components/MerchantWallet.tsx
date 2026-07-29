import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { ArrowUpRight, CreditCard, Landmark, RefreshCw, Wallet } from 'lucide-react';
import { apiClient } from '../../../services/apiClient';
import { API_URL } from '../../../config/publicEnv';
import { Card } from '../../../components/ui';

interface WalletSnapshot {
  mercadoPagoConnected: boolean;
  onlineGross: number;
  marketplaceFees: number;
  estimatedSellerTransfer: number;
  offlineReceivables: number;
  onlineOrders: number;
  offlineOrders: number;
  mercadoPagoAccountUrl: string;
  disclaimer: string;
  transactions: Array<{
    id: string;
    createdAt: string;
    paymentMethod: string;
    paymentStatus?: string;
    gross: number;
    platformFee: number;
    estimatedNet: number;
  }>;
}

const money = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

export const MerchantWallet: React.FC<{ merchantId?: string }> = ({ merchantId }) => {
  const [wallet, setWallet] = useState<WalletSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadWallet = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await apiClient.get('/payments/wallet');
      setWallet(response.data.data.wallet);
    } catch (requestError: unknown) {
      const message = axios.isAxiosError(requestError)
        ? requestError.response?.data?.message
        : undefined;
      setError(message || 'Não foi possível carregar a carteira.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void apiClient.get('/payments/wallet')
      .then((response) => setWallet(response.data.data.wallet))
      .catch((requestError: unknown) => {
        const message = axios.isAxiosError(requestError)
          ? requestError.response?.data?.message
          : undefined;
        setError(message || 'Não foi possível carregar a carteira.');
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card className="p-6 flex items-center gap-3 text-sm text-slate-500">
        <RefreshCw size={18} className="animate-spin text-energy" />
        Conciliando movimentações...
      </Card>
    );
  }

  if (error || !wallet) {
    return (
      <Card className="p-6 flex items-center justify-between gap-4">
        <span className="text-sm text-red-600">{error}</span>
        <button onClick={loadWallet} className="text-sm font-bold text-energy">Tentar novamente</button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-6 overflow-hidden border border-energy/20 bg-gradient-to-br from-slate-950 to-slate-800 text-white rounded-3xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <Wallet size={18} className="text-energy" />
              Carteira do lojista
            </div>
            <p className="text-3xl font-black mt-3">{money(wallet.estimatedSellerTransfer)}</p>
            <p className="text-xs text-slate-400 mt-1">Repasse online estimado antes das tarifas do Mercado Pago</p>
          </div>

          {wallet.mercadoPagoConnected ? (
            <a
              href={wallet.mercadoPagoAccountUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-energy hover:bg-energy-dark font-bold text-sm transition-colors"
            >
              Ver saldo e sacar no Mercado Pago <ArrowUpRight size={16} />
            </a>
          ) : (
            <a
              href={`${API_URL}/payments/oauth/connect?merchantId=${merchantId || ''}`}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-energy hover:bg-energy-dark font-bold text-sm transition-colors"
            >
              Conectar Mercado Pago <ArrowUpRight size={16} />
            </a>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
          <div className="rounded-2xl bg-white/5 p-4">
            <p className="text-xs text-slate-400">Vendas online confirmadas</p>
            <p className="font-black text-lg mt-1">{money(wallet.onlineGross)}</p>
          </div>
          <div className="rounded-2xl bg-white/5 p-4">
            <p className="text-xs text-slate-400">Taxas da plataforma</p>
            <p className="font-black text-lg mt-1">{money(wallet.marketplaceFees)}</p>
          </div>
          <div className="rounded-2xl bg-white/5 p-4">
            <p className="text-xs text-slate-400">Recebimentos no local</p>
            <p className="font-black text-lg mt-1">{money(wallet.offlineReceivables)}</p>
          </div>
        </div>
        <p className="text-[11px] text-slate-400 mt-4">{wallet.disclaimer}</p>
      </Card>

      <Card className="border border-slate-200/60 dark:border-slate-800 overflow-hidden rounded-2xl">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
          <Landmark size={18} className="text-energy" />
          <h4 className="font-bold text-slate-800 dark:text-white">Movimentações conciliadas</h4>
        </div>
        {wallet.transactions.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">Nenhuma movimentação válida ainda.</p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {wallet.transactions.map((transaction) => (
              <div key={transaction.id} className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    <CreditCard size={17} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800 dark:text-white truncate">
                      Pedido #{transaction.id.slice(0, 8)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {transaction.paymentMethod} · {new Date(transaction.createdAt).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-slate-800 dark:text-white">
                    {money(transaction.estimatedNet)}
                  </p>
                  {transaction.platformFee > 0 && (
                    <p className="text-[11px] text-slate-500">taxa {money(transaction.platformFee)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
