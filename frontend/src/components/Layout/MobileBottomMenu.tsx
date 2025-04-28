import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  BottomNavigation,
  BottomNavigationAction,
  Badge
} from '@mui/material';
import ChatIcon from '@mui/icons-material/Chat';
import ApartmentIcon from '@mui/icons-material/Apartment';
import NotificationsIcon from '@mui/icons-material/Notifications';
import MenuIcon from '@mui/icons-material/Menu';

interface MobileBottomMenuProps {
  onMenuClick?: () => void;
}

const MobileBottomMenu = ({ onMenuClick }: MobileBottomMenuProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Déterminer la valeur active en fonction de l'URL actuelle
  const getActiveValue = () => {
    if (location.pathname === '/') return 'messages';
    if (location.pathname === '/properties') return 'apartments';
    if (location.pathname === '/urgency') return 'urgency';
    if (location.pathname === '/menu') return 'menu';
    return 'messages'; // Valeur par défaut
  };
  
  const [navValue, setNavValue] = useState(getActiveValue());

  const handleChange = (_event: React.SyntheticEvent, newValue: string) => {
    setNavValue(newValue);
    
    if (newValue === 'messages') {
      navigate('/');
    } else if (newValue === 'apartments') {
      navigate('/properties');
    } else if (newValue === 'urgency') {
      // La page d'urgence n'existe pas encore, mais sera ajoutée plus tard
      // navigate('/urgency');
    } else if (newValue === 'menu' && onMenuClick) {
      onMenuClick();
    }
  };

  return (
    <BottomNavigation 
      value={navValue}
      onChange={handleChange}
      showLabels
      sx={{ 
        width: '100%', 
        position: 'fixed', 
        bottom: 0,
        zIndex: 1000,
        borderTop: '1px solid rgba(0, 0, 0, 0.12)'
      }}
    >
      <BottomNavigationAction 
        label="Messages" 
        value="messages"
        icon={<ChatIcon />} 
        sx={{ minWidth: 'auto' }}
      />
      <BottomNavigationAction 
        label="Appartements" 
        value="apartments"
        icon={<ApartmentIcon />} 
        sx={{ minWidth: 'auto' }}
      />
      <BottomNavigationAction 
        label="Urgences" 
        value="urgency"
        icon={
          <Badge badgeContent={0} color="error">
            <NotificationsIcon />
          </Badge>
        } 
        sx={{ minWidth: 'auto' }}
      />
      <BottomNavigationAction 
        label="Menu" 
        value="menu"
        icon={<MenuIcon />} 
        sx={{ minWidth: 'auto' }}
      />
    </BottomNavigation>
  );
};

export default MobileBottomMenu;
