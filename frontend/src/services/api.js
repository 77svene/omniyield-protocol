import { BASE_URL } from '../config';

export const api = {
  async getVaultStats() {
    try {
      const response = await fetch(`${BASE_URL}/vault/stats`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch vault stats:', error);
      throw error;
    }
  },

  async getUserCollateral(address) {
    try {
      const response = await fetch(`${BASE_URL}/user/${address}/collateral`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch user collateral:', error);
      throw error;
    }
  },

  async getBorrowLimit(address) {
    try {
      const response = await fetch(`${BASE_URL}/user/${address}/borrow-limit`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch borrow limit:', error);
      throw error;
    }
  },

  async getYieldsEarned(address) {
    try {
      const response = await fetch(`${BASE_URL}/user/${address}/yields`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch yields earned:', error);
      throw error;
    }
  },

  async buildTransaction(action, params) {
    try {
      const response = await fetch(`${BASE_URL}/transaction-builder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, params }),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to build transaction:', error);
      throw error;
    }
  },
};