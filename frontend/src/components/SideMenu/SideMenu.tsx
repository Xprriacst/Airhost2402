import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FaHome, FaComments, FaExclamationTriangle, FaFlask, FaWhatsapp, FaSignOutAlt } from 'react-icons/fa';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-toastify';
import './SideMenu.css';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Box, Avatar, Typography } from '@mui/material';
import { useUser } from '../../lib/auth';
import { WhatsAppService } from '../../services/chat/whatsapp.service';

interface MenuItem {
  path: string;
  label: string;
  icon: React.ReactElement;
  onClick?: () => void;
}

const SideMenu: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [configOpen, setConfigOpen] = useState(false);
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [whatsappToken, setWhatsappToken] = useState('');
  const [saving, setSaving] = useState(false);

  // Récupérer l'utilisateur connecté
  const user = useUser();

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Erreur lors de la déconnexion:', error);
        toast.error('Erreur lors de la déconnexion');
      } else {
        toast.success('Vous avez été déconnecté avec succès');
        navigate('/login');
      }
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Une erreur est survenue');
    }
  };

  const openWhatsAppConfig = async () => {
    console.log('Ouverture de la configuration WhatsApp via service WhatsApp');
    toast.info('Chargement de la configuration WhatsApp...');
    
    try {
      // Utiliser le service WhatsApp directement
      const config = await WhatsAppService.getConfig();
      
      console.log('Configuration WhatsApp récupérée:', config);
      
      if (config) {
        setPhoneNumberId(config.phone_number_id || '');
        setWhatsappToken(config.token || '');
      } else {
        console.log('Aucune configuration WhatsApp trouvée, utilisation des valeurs par défaut');
        toast.info('Aucune configuration WhatsApp existante.');
      }

      // Force l'ouverture de la popup
      setConfigOpen(true);
      console.log('État configOpen:', true);
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Une erreur est survenue');
    }
  };

  const handleSaveConfig = async () => {
    try {
      setSaving(true);
      
      // Préparer les données de configuration
      const configData = {
        phone_number_id: phoneNumberId,
        token: whatsappToken
      };
      
      console.log("Sauvegarde de la configuration WhatsApp via service WhatsApp:", configData);
      
      // Utiliser le service WhatsApp directement
      const success = await WhatsAppService.saveConfig(configData);
      
      if (!success) {
        console.error("Erreur lors de la sauvegarde de la configuration WhatsApp");
        toast.error('Erreur lors de la sauvegarde');
        setSaving(false);
        return;
      }
      
      console.log("Configuration WhatsApp sauvegardée avec succès");
      toast.success('Configuration sauvegardée avec succès');
      setConfigOpen(false);
      setSaving(false);
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Une erreur est survenue');
      setSaving(false);
    }
  };

  const mainMenuItems: MenuItem[] = [
    { path: '/chat', label: 'Conversations', icon: <FaComments /> },
    { path: '/properties', label: 'Appartements', icon: <FaHome /> },
    { path: '/emergency', label: 'Cas d\'urgence', icon: <FaExclamationTriangle /> },
    { path: '/sandbox', label: 'Chat Sandbox', icon: <FaFlask /> },
  ];

  const bottomMenuItems: MenuItem[] = [
    { 
      path: '#', 
      label: 'Configuration WhatsApp', 
      icon: <FaWhatsapp />,
      onClick: openWhatsAppConfig
    },
    { 
      path: '#', 
      label: 'SE DÉCONNECTER', 
      icon: <FaSignOutAlt />,
      onClick: handleLogout
    },
  ];

  const renderMenuItem = (item: MenuItem) => (
    <Link
      key={item.path}
      to={item.onClick ? '#' : item.path}
      className={`menu-item ${location.pathname === item.path ? 'active' : ''}`}
      onClick={item.onClick}
    >
      <span className="menu-icon">{item.icon}</span>
      <span className="menu-label">{item.label}</span>
    </Link>
  );

  return (
    <>
      <div className="side-menu">
        <div className="user-info">
          <Avatar className="avatar">{user?.user_metadata?.name?.[0]}</Avatar>
          <div>
            <Typography variant="subtitle1">{user?.user_metadata?.name}</Typography>
            <Typography variant="caption" color="textSecondary">
              {user?.email}
            </Typography>
          </div>
        </div>
        <div className="menu-header">
          <h2 className="app-title">AirHost Admin</h2>
        </div>
        <nav className="menu-nav">
          {mainMenuItems.map(renderMenuItem)}
        </nav>
        <nav className="menu-nav bottom-nav">
          {bottomMenuItems.map(renderMenuItem)}
        </nav>
      </div>

      {/* Dialog de configuration WhatsApp */}
      <Dialog 
        open={configOpen} 
        onClose={() => {
          console.log('Fermeture du dialog');
          setConfigOpen(false);
        }} 
        maxWidth="sm" 
        fullWidth
        sx={{ zIndex: 1400 }}
      >
        <DialogTitle>Configuration WhatsApp</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <TextField
              label="Phone Number ID"
              variant="outlined"
              fullWidth
              value={phoneNumberId}
              onChange={(e) => setPhoneNumberId(e.target.value)}
              placeholder="Entrez votre Phone Number ID WhatsApp"
            />
            <TextField
              label="Token WhatsApp"
              variant="outlined"
              fullWidth
              value={whatsappToken}
              onChange={(e) => setWhatsappToken(e.target.value)}
              type="password"
              placeholder="Entrez votre token WhatsApp"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => {
              console.log('Annulation de la configuration');
              setConfigOpen(false);
            }}
          >
            Annuler
          </Button>
          <Button 
            onClick={handleSaveConfig} 
            variant="contained" 
            color="primary"
            disabled={saving}
          >
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default SideMenu;
