// Newsletter signup endpoint — adds email to Listmonk mailing list
const { addToListmonk } = require('./listmonk');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email is required' });
    }

    const emailLower = email.toLowerCase().trim();

    await addToListmonk(emailLower, '', {
      source: 'newsletter_signup',
    });

    return res.status(200).json({
      success: true,
      message: 'Successfully subscribed!'
    });
  } catch (error) {
    console.error('Newsletter signup error:', error);
    return res.status(500).json({ error: 'Failed to subscribe. Please try again later.' });
  }
};
