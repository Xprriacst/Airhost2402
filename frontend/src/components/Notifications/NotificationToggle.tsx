import { useState, useEffect } from 'react';
import { Button, Typography, Box, Switch, FormControlLabel, Paper, Alert, Tooltip } from '@mui/material';
import { NotificationService } from '../../services/notification.service';
import NotificationsIcon from '@mui/icons-material/Notifications';
import NotificationsOffIcon from '@mui/icons-material/NotificationsOff';

const NotificationToggle = () => {
  // État pour le statut des notifications
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Vérifier le statut des notifications au chargement du composant
  useEffect(() => {
    const checkNotificationStatus = async () => {
      try {
        setLoading(true);
        const enabled = await NotificationService.areNotificationsEnabled();
        setNotificationsEnabled(enabled);
        setError(null);
      } catch (error) {
        console.error('Erreur lors de la vérification du statut des notifications:', error);
        setError('Impossible de vérifier le statut des notifications');
      } finally {
        setLoading(false);
      }
    };

    checkNotificationStatus();
  }, []);

  // Gérer l'activation/désactivation des notifications
  const handleToggleNotifications = async () => {
    try {
      setLoading(true);
      setError(null);

      if (notificationsEnabled) {
        // Désactiver les notifications
        const success = await NotificationService.unsubscribe();
        if (success) {
          setNotificationsEnabled(false);
        } else {
          setError('Impossible de désactiver les notifications');
        }
      } else {
        // Activer les notifications
        const success = await NotificationService.requestPermission();
        setNotificationsEnabled(success);
        if (!success) {
          setError('Vous avez refusé l\'autorisation pour les notifications');
        }
      }
    } catch (error) {
      console.error('Erreur lors de la modification des notifications:', error);
      setError('Une erreur est survenue lors de la modification des notifications');
    } finally {
      setLoading(false);
    }
  };

  // Vérifier si le navigateur prend en charge les notifications
  const notificationsSupported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;

  return (
    <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
      <Typography variant="h6" gutterBottom>
        Notifications
      </Typography>
      
      {!notificationsSupported ? (
        <Alert severity="warning">
          Votre navigateur ne prend pas en charge les notifications push
        </Alert>
      ) : (
        <>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <FormControlLabel
              control={
                <Switch
                  checked={notificationsEnabled}
                  onChange={handleToggleNotifications}
                  disabled={loading}
                  color="primary"
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  {notificationsEnabled ? (
                    <NotificationsIcon color="primary" sx={{ mr: 1 }} />
                  ) : (
                    <NotificationsOffIcon sx={{ mr: 1 }} />
                  )}
                  <Typography>
                    Notifications {notificationsEnabled ? 'activées' : 'désactivées'}
                  </Typography>
                </Box>
              }
            />
            
            <Tooltip title={notificationsEnabled ? 
              "Vous recevrez des notifications lorsque de nouveaux messages arriveront, même lorsque l'application est fermée" : 
              "Activez les notifications pour être alerté des nouveaux messages même lorsque l'application est fermée"
            }>
              <Button 
                variant="outlined" 
                onClick={handleToggleNotifications}
                disabled={loading}
                startIcon={notificationsEnabled ? <NotificationsOffIcon /> : <NotificationsIcon />}
              >
                {notificationsEnabled ? 'Désactiver' : 'Activer'}
              </Button>
            </Tooltip>
          </Box>
          
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {notificationsEnabled 
              ? "Vous serez notifié des nouveaux messages même lorsque l'application est fermée" 
              : "Activez les notifications pour ne manquer aucun message de vos clients"}
          </Typography>
        </>
      )}
    </Paper>
  );
};

export default NotificationToggle;
