import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Message, MessageService } from '../services/chat/message.service';
import { useMessageSender, saveMessageLocally } from './useMessageSender';

// Préfixe pour les logs liés à ce hook
const DEBUG_PREFIX = 'DEBUG_USE_MESSAGES_REALTIME';

// Intervalle de polling en millisecondes
const POLLING_INTERVAL = 10000; // 10 secondes
// Intervalle pour le rafraîchissement automatique forcé 
// (est utilisé plus loin dans le code pour vérifier périodiquement les nouveaux messages)
const AUTO_REFRESH_INTERVAL = 30000; // 30 secondes

interface UseMessagesRealtimeResult {
  messages: Message[];
  realtimeStatus: 'SUBSCRIBED' | 'CONNECTING' | 'DISCONNECTED' | 'ERROR';
  refreshing: boolean;
  isPollingActive: boolean;
  forceRefresh: () => Promise<void>;
  lastMessageCount: number;
}

export function useMessagesRealtime(conversationId: string): UseMessagesRealtimeResult {
  const [messages, setMessages] = useState<Message[]>([]);
  const [realtimeStatus, setRealtimeStatus] = useState<'SUBSCRIBED' | 'CONNECTING' | 'DISCONNECTED' | 'ERROR'>('CONNECTING');
  const [refreshing, setRefreshing] = useState(false);
  const [isPollingActive, setIsPollingActive] = useState(false);
  const [lastMessageCount, setLastMessageCount] = useState(0);
  
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const messagesChannelRef = useRef<any>(null);
  const { getLocalMessages } = useMessageSender();
  
  // Fonction pour charger les messages
  const loadMessages = async (showRefreshing = true, forceNetwork = true) => {
    if (!conversationId) {
      console.error(`${DEBUG_PREFIX} ID de conversation invalide: ${conversationId}`);
      return;
    }
    
    if (showRefreshing) {
      setRefreshing(true);
    }
    
    const timestamp = new Date().toISOString();
    console.log(`${DEBUG_PREFIX} [${timestamp}] Chargement des messages pour la conversation: ${conversationId}, forceNetwork: ${forceNetwork}`);
    
    try {
      // 1. Récupérer les messages stockés localement d'abord
      // (pour s'assurer qu'ils sont toujours disponibles)
      const localMessages = getLocalMessages(conversationId);
      console.log(`${DEBUG_PREFIX} [${timestamp}] ${localMessages.length} messages récupérés depuis le stockage local`);
      
      let combinedMessages = [...localMessages];
      
      try {
        // 2. Récupérer les messages depuis la base de données
        // Force le rechargement complet en utilisant un AbortController pour éviter le cache
        const fetchedMessages = await MessageService.getMessages(conversationId, forceNetwork as boolean);
        console.log(`${DEBUG_PREFIX} [${timestamp}] ${fetchedMessages.length} messages récupérés depuis la BDD`);
        
        // Afficher les derniers messages récupérés pour débogage
        if (fetchedMessages.length > 0) {
          const latestMessages = fetchedMessages.sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          ).slice(0, 3);
          
          console.log(`${DEBUG_PREFIX} [${timestamp}] Derniers messages récupérés:`, 
            latestMessages.map(m => ({
              id: m.id,
              content: m.content ? (m.content.substring(0, 20) + '...') : 'CONTENU MANQUANT',
              created_at: m.created_at
            }))
          );
        }
        
        // Ajouter les messages de la BDD à la liste combinée
        combinedMessages = [...combinedMessages, ...fetchedMessages];
      } catch (dbError) {
        // En cas d'erreur avec la base de données, on continue avec les messages locaux
        console.error(`${DEBUG_PREFIX} [${timestamp}] Erreur lors de la récupération depuis la BDD, utilisation des messages locaux uniquement:`, dbError);
      }
      
      console.log(`${DEBUG_PREFIX} [${timestamp}] ${combinedMessages.length} messages combinés avant déduplication`);
      
      // Assurer l'unicité des messages
      const uniqueMessages = deduplicateMessages(combinedMessages);
      console.log(`${DEBUG_PREFIX} [${timestamp}] ${uniqueMessages.length} messages uniques après déduplication`);
      
      // Trier les messages par date de création
      const sortedMessages = [...uniqueMessages].sort((a, b) => {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
      
      // Détection des messages manquants ou différents par rapport à l'état précédent
      if (messages.length > 0 && sortedMessages.length !== messages.length) {
        console.log(`${DEBUG_PREFIX} [${timestamp}] Différence détectée dans le nombre de messages: ${messages.length} -> ${sortedMessages.length}`);
        
        // Afficher les messages potentiellement ajoutés ou supprimés
        if (sortedMessages.length > messages.length) {
          const newIds = new Set(sortedMessages.map(m => m.id));
          const existingIds = new Set(messages.map(m => m.id));
          const addedMessageIds = [...newIds].filter(id => !existingIds.has(id));
          
          console.log(`${DEBUG_PREFIX} [${timestamp}] Messages ajoutés: ${addedMessageIds.join(', ')}`);
        }
      }
      
      // Mettre à jour l'état des messages
      setMessages(sortedMessages);
      setLastMessageCount(sortedMessages.length);
    } catch (error) {
      console.error(`${DEBUG_PREFIX} [${timestamp}] Erreur lors du chargement des messages:`, error);
    } finally {
      if (showRefreshing) {
        setRefreshing(false);
      }
    }
  };
  
  // Fonction pour dédupliquer les messages
  const deduplicateMessages = (messages: Message[]): Message[] => {
    const uniqueMap = new Map();
    messages.forEach(message => {
      uniqueMap.set(message.id, message);
    });
    return Array.from(uniqueMap.values());
  };
  
  // Gestionnaire pour les nouveaux messages
  const handleNewMessage = (payload: any) => {
    const timestamp = new Date().toISOString();
    console.log(`${DEBUG_PREFIX} [${timestamp}] Nouveau message détecté via Realtime:`, payload);
    
    if (payload.new) {
      const newMessage = payload.new as Message;
      
      // Vérifier si le message appartient à la conversation active
      if (payload.new.conversation_id === conversationId) {
        console.log(`${DEBUG_PREFIX} [${timestamp}] Ajout du nouveau message à la conversation - ID: ${newMessage.id}, Created: ${newMessage.created_at}`);
        console.log(`${DEBUG_PREFIX} [${timestamp}] Contenu du message: ${newMessage.content?.substring(0, 50)}${newMessage.content && newMessage.content.length > 50 ? '...' : ''}`);
        
        // Vérifier si c'est un message entrant pour déclencher une notification
        if (newMessage.direction === 'inbound') {
          console.log(`${DEBUG_PREFIX} [${timestamp}] Message entrant détecté, tentative d'envoi de notification pour: ${newMessage.id}`);
          MessageService.notifyNewMessage(newMessage, conversationId);
        } else {
          console.log(`${DEBUG_PREFIX} [${timestamp}] Message sortant ou direction non définie (${newMessage.direction}), pas de notification`);
        }

        // Mettre à jour l'état des messages en évitant les doublons
        setMessages(prevMessages => {
          // Vérifier si le message existe déjà
          const messageExists = prevMessages.some(msg => msg.id === newMessage.id);
          
          if (messageExists) {
            console.log(`${DEBUG_PREFIX} [${timestamp}] Message déjà présent dans l'état`);
            return prevMessages;
          }
          
          // Ajouter le nouveau message et trier
          const updatedMessages = [...prevMessages, newMessage].sort((a, b) => {
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          });
          
          console.log(`${DEBUG_PREFIX} [${timestamp}] État mis à jour: ${updatedMessages.length} messages`);
          
          // Sauvegarder le message localement
          try {
            // Utiliser la fonction importée en haut du fichier
            saveMessageLocally(newMessage);
            console.log(`${DEBUG_PREFIX} [${timestamp}] Message également sauvegardé localement via Realtime`);
          } catch (error) {
            console.error(`${DEBUG_PREFIX} [${timestamp}] Erreur lors de la sauvegarde locale du message reçu:`, error);
          }
          
          return updatedMessages;
        });
        
        // Force un rafraîchissement après réception d'un message Realtime pour s'assurer que tout est synchronisé
        setTimeout(() => {
          console.log(`${DEBUG_PREFIX} [${timestamp}] Rafraîchissement après réception d'un message Realtime`);
          loadMessages(false, true); // Ne pas montrer l'icône de chargement
        }, 1000); // Petit délai pour éviter de surcharger
      } else {
        console.log(`${DEBUG_PREFIX} [${timestamp}] Message ignoré car il n'appartient pas à la conversation active: ${payload.new.conversation_id} !== ${conversationId}`);
      }
    }
  };
  
  // Fonction pour rafraîchir manuellement les messages
  const forceRefresh = async () => {
    console.log(`${DEBUG_PREFIX} Rafraîchissement manuel des messages`);
    await loadMessages(true, true);
  };
  
  // Fonction pour démarrer le polling
  const startPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    
    console.log(`${DEBUG_PREFIX} Démarrage du polling tous les ${POLLING_INTERVAL / 1000} secondes`);
    setIsPollingActive(true);
    
    pollingIntervalRef.current = setInterval(() => {
      console.log(`${DEBUG_PREFIX} Exécution du polling`);
      loadMessages(false, true); // Force une requête réseau fraîche à chaque polling
    }, POLLING_INTERVAL);
  };
  
  // Fonction pour arrêter le polling
  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      console.log(`${DEBUG_PREFIX} Arrêt du polling`);
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      setIsPollingActive(false);
    }
  };
  
  // Fonction pour charger les messages initiaux et configurer Realtime
  const setupRealtimeAndInitialLoad = () => {
    const timestamp = new Date().toISOString();
    console.log(`${DEBUG_PREFIX} [${timestamp}] Configuration de Realtime et chargement initial des messages`);
    
    // Charger les messages initiaux avec une requête fraîche
    loadMessages(true, true);
    
    // Configurer la souscription Realtime
    try {
      console.log(`${DEBUG_PREFIX} [${timestamp}] Mise en place de la souscription realtime pour la conversation: ${conversationId}`);
      
      // Canal pour les messages
      const messagesChannel = supabase
        .channel('messages-channel')
        .on(
          'postgres_changes', 
          { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'messages',
            filter: `conversation_id=eq.${conversationId}`
          }, 
          handleNewMessage
        )
        .subscribe((status) => {
          console.log(`${DEBUG_PREFIX} [${timestamp}] Statut du canal messages: ${status}`);
          setRealtimeStatus(status === 'SUBSCRIBED' ? 'SUBSCRIBED' : 'DISCONNECTED');
          
          // Si la souscription échoue, activer le polling
          if (status !== 'SUBSCRIBED') {
            console.log(`${DEBUG_PREFIX} [${timestamp}] La souscription Realtime a échoué, activation du polling`);
            startPolling();
          } else {
            // Si la souscription réussit, arrêter le polling
            stopPolling();
          }
        });
      
      messagesChannelRef.current = messagesChannel;
      
    } catch (error) {
      console.error(`${DEBUG_PREFIX} [${timestamp}] Erreur lors de la configuration de Realtime:`, error);
      setRealtimeStatus('ERROR');
      
      // En cas d'erreur, activer le polling
      startPolling();
    }
  };
  
  // Effet pour configurer Realtime et charger les messages initiaux
  useEffect(() => {
    console.log(`${DEBUG_PREFIX} useEffect déclenché avec conversationId:`, conversationId);
    
    if (!conversationId) {
      console.error(`${DEBUG_PREFIX} ID de conversation invalide, impossible de configurer Realtime`);
      return;
    }
    
    setRealtimeStatus('CONNECTING');
    
    // Référence pour le rafraîchissement automatique
    let autoRefreshInterval: NodeJS.Timeout | null = null;

    // Configurer Realtime et charger les messages initiaux
    setupRealtimeAndInitialLoad();
    
    // Configurer un rafraîchissement périodique (toutes les 30 secondes)
    autoRefreshInterval = setInterval(() => {
      console.log(`${DEBUG_PREFIX} Rafraîchissement automatique périodique des messages`);
      loadMessages(false, true); // Force une requête fraîche sans montrer l'indicateur de chargement
    }, AUTO_REFRESH_INTERVAL);
    
    // Nettoyage
    return () => {
      console.log(`${DEBUG_PREFIX} Nettoyage: désinscription du canal Realtime, arrêt du polling et du rafraîchissement automatique`);
      
      if (messagesChannelRef.current) {
        messagesChannelRef.current.unsubscribe();
        messagesChannelRef.current = null;
      }
      
      // Arrêter le polling
      stopPolling();
      
      // Arrêter le rafraîchissement automatique
      if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
        console.log(`${DEBUG_PREFIX} Arrêt du rafraîchissement automatique`);  
      }
    };
  }, [conversationId]);
  
  // Retourner l'état et les fonctions
  return {
    messages,
    realtimeStatus,
    refreshing,
    isPollingActive,
    forceRefresh,
    lastMessageCount
  };
}
