const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

exports.handler = async function(event, context) {
  console.log('Function invoked with event:', event);
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
  );
  // Vérifier la méthode HTTP
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    let { to, template_name = 'hello_world', language = 'en_US' } = JSON.parse(event.body);
    console.log('Parsed request body:', { to, template_name, language });
    console.log('Using default template "hello_world" if not specified');

    // Récupérer la configuration WhatsApp la plus récente
    console.log('Connecting to Supabase with URL:', process.env.VITE_SUPABASE_URL);

    const { data: whatsappConfig, error: configError } = await supabase
      .from('whatsapp_config')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);

    console.log('WhatsApp config response:', { whatsappConfig, configError });

    if (configError) throw new Error('Erreur lors de la récupération de la configuration WhatsApp');
    if (!whatsappConfig || whatsappConfig.length === 0) throw new Error('Aucune configuration WhatsApp trouvée');

    const whatsappToken = whatsappConfig[0].token;
    const phoneNumberId = whatsappConfig[0].phone_number_id;

    if (!whatsappToken || !phoneNumberId) {
      throw new Error('Configuration WhatsApp manquante');
    }

    console.log('Sending WhatsApp message with:', { phoneNumberId, template: template_name, language, to });

    const response = await fetch(
      `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${whatsappToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: to,
          type: 'template',
          template: {
            name: template_name,
            language: {
              code: language
            }
          }
        })
      }
    );

    const data = await response.json();
    console.log('WhatsApp API response:', { status: response.status, data });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    };
  } catch (error) {
    console.error('Erreur:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
