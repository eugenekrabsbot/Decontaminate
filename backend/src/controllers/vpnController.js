const getServers = async (req, res) => {
  res.status(501).json({ error: 'Not implemented' });
};

const getWireGuardConfig = async (req, res) => {
  res.status(501).json({ error: 'Not implemented' });
};

const getOpenVPNConfig = async (req, res) => {
  res.status(501).json({ error: 'Not implemented' });
};

const connect = async (req, res) => {
  res.status(501).json({ error: 'Not implemented' });
};

const disconnect = async (req, res) => {
  res.status(501).json({ error: 'Not implemented' });
};

const getConnections = async (req, res) => {
  res.status(501).json({ error: 'Not implemented' });
};

module.exports = {
  getServers,
  getWireGuardConfig,
  getOpenVPNConfig,
  connect,
  disconnect,
  getConnections,
};