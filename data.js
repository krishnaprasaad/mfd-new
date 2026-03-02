// Mock database of users and their portfolios
export const mockDatabase = {
  "investor@example.com": {
    password: "password123", // In a real app, passwords are NEVER stored openly plains text like this
    profile: {
      name: "Alex Johnson",
      email: "investor@example.com"
    },
    portfolio: {
      totalInvested: 1540000,
      currentValue: 1895200,
      investments: [
        {
          id: "mf-101",
          name: "Aurora Bluechip Equity Fund",
          category: "Large Cap",
          investedAmount: 500000,
          currentValue: 645000,
          returnsPercent: 29.0
        },
        {
          id: "mf-102",
          name: "Aurora Emerging Opportunities",
          category: "Small Cap",
          investedAmount: 300000,
          currentValue: 412000,
          returnsPercent: 37.33
        },
        {
          id: "mf-103",
          name: "Aurora Stable Debt Fund",
          category: "Debt",
          investedAmount: 500000,
          currentValue: 535000,
          returnsPercent: 7.0
        },
        {
          id: "mf-104",
          name: "Aurora Flexi Cap Advantage",
          category: "Flexi Cap",
          investedAmount: 240000,
          currentValue: 303200,
          returnsPercent: 26.33
        }
      ]
    }
  },
  "johndoe@example.com": {
    password: "password",
    profile: {
      name: "John Doe",
      email: "johndoe@example.com"
    },
    portfolio: {
      totalInvested: 500000,
      currentValue: 480000,
      investments: [
        {
          id: "mf-201",
          name: "Aurora Tech Sector Fund",
          category: "Thematic",
          investedAmount: 500000,
          currentValue: 480000,
          returnsPercent: -4.0
        }
      ]
    }
  }
};
