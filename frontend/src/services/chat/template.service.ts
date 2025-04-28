import { supabase } from '../../lib/supabase';
import { WhatsAppService } from './whatsapp.service';

export interface Template {
  id: string;
  name: string;
  content: string;
  language: string;
  variables: Record<string, any>;
  description?: string;
  created_at: string;
}

export class TemplateService {
  static async getTemplates() {
    // Récupérer la session pour obtenir l'ID de l'utilisateur
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    
    console.log('Récupération des templates pour l\'utilisateur:', userId);
    
    // Récupérer uniquement les templates associés à l'utilisateur connecté
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .eq('host_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erreur lors de la récupération des templates:', error);
      throw error;
    }
    
    console.log('Templates récupérés:', data?.length || 0);
    return data as Template[];
  }

  static async sendTemplate(
    conversationId: string, 
    guestPhone: string, 
    template: Template
  ) {
    console.log('[TemplateService] Envoi du template via WhatsAppService:', {
      template_name: template.name,
      language: template.language,
      to: guestPhone
    });
    
    // Utiliser directement le service WhatsApp pour envoyer le template
    // Cette approche est cohérente avec les modifications précédentes où nous avons remplacé
    // les appels aux Edge Functions par des appels directs au service WhatsApp
    await WhatsAppService.sendTemplate(
      guestPhone,
      template.name,
      template.language
    );

    // Pas besoin de vérifier la réponse ici car WhatsAppService.sendTemplate gère déjà les erreurs

    // Créer le message dans la base de données avec le contenu réel du template
    const { error: msgError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        content: template.content,
        direction: 'outbound',
        type: 'template',
        status: 'sent',
        metadata: {
          template_name: template.name,
          template_id: template.id
        }
      });

    if (msgError) throw msgError;
  }
}
