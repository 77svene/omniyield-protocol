import { WagmiConfig } from 'wagmi';
import { configureChains, createClient, mainnet, sepolia } from 'wagmi';
import { publicProvider } from 'wagmi/providers/public';
import { MetaMask } from 'wagmi/connectors/metaMask';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import './App.css';

// Read chain ID from environment variable, default to sepolia
const chainId = Number(process.env.REACT_APP_CHAIN_ID || 11155111);
const chains = chainId === 1 ? [mainnet] : [sepolia];

// Configure wagmi
const { provider } = configureChains(chains, [publicProvider()]);
const wagmiClient = createClient({
  autoConnect: true,
  connectors: [new MetaMask({ chains })],
  provider,
});

function App() {
  return (
    <WagmiConfig client={wagmiClient}>
      <BrowserRouter>
        <div className="App">
          <header className="App-header">
            <h1>OmniYield Dashboard</h1>
          </header>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </BrowserRouter>
    </WagmiConfig>
  );
}

export default App;