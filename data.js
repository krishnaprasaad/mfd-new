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

// Mock data for the Explore Funds section
export const mockFundsList = [
  {
    id: "f-001",
    name: "Aurora Future Tech Fund",
    category: "Thematic - Tech",
    risk: "High",
    minSip: 1000,
    return1Yr: 42.5,
    return3Yr: 28.4,
    description: "Invests in high-growth technology companies focused on AI, robotics, and cloud computing globally."
  },
  {
    id: "f-002",
    name: "Aurora Core Equity Advantage",
    category: "Large Cap",
    risk: "Moderate",
    minSip: 500,
    return1Yr: 21.2,
    return3Yr: 15.8,
    description: "A stable foundation for your portfolio, investing in top 100 blue-chip companies with proven track records."
  },
  {
    id: "f-003",
    name: "Aurora Green Energy Focus",
    category: "Sectoral - ESG",
    risk: "High",
    minSip: 1000,
    return1Yr: 35.8,
    return3Yr: 22.1,
    description: "Capitalizes on the global transition to renewable energy and sustainable business practices."
  },
  {
    id: "f-004",
    name: "Aurora Dynamic Bond Fund",
    category: "Debt - Dynamic",
    risk: "Low",
    minSip: 5000,
    return1Yr: 8.5,
    return3Yr: 7.2,
    description: "Actively managed debt portfolio adjusting duration based on interest rate outlook for consistent returns."
  },
  {
    id: "f-005",
    name: "Aurora Midcap Outperform",
    category: "Mid Cap",
    risk: "High",
    minSip: 1000,
    return1Yr: 48.3,
    return3Yr: 26.5,
    description: "Targets tomorrow's leaders by investing in fast-growing mid-sized companies with strong scalability."
  },
  {
    id: "f-006",
    name: "Aurora Balanced Advantage",
    category: "Hybrid",
    risk: "Moderate",
    minSip: 1000,
    return1Yr: 18.5,
    return3Yr: 14.1,
    description: "Automatically balances between equity and debt based on market valuations to optimize risk-adjusted returns."
  }
];
