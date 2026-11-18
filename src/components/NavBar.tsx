import {
  AppBar,
  Box,
  Button,
  Container,
  Stack,
  Toolbar,
  Typography,
} from '@mui/material';
import { useTheme } from "@mui/material/styles";
import { Link as RouterLink, useLocation } from 'react-router-dom';

const links = [
  { label: 'Home', to: '/' },
  { label: 'Answer List', to: '/answerlist' },
  { label: 'Three Rounds to Four', to: '/threeToFour' },
  { label: 'Round To Last Letter Round', to: '/roundToLastLetter' },
];

export default function NavBar() {
  const { pathname } = useLocation();

  const theme = useTheme();

  const logo = theme.palette.mode === "dark"
        ? "/logo_dark.png"
        : "/logo_light.png";

  return (
    <AppBar
      position="static"
      color="inherit"
      component="header"
      sx={{
        bgcolor: 'background.paper',
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <Container maxWidth="lg">
        <Toolbar
          disableGutters
          sx={{
            minHeight: { xs: 88, sm: 80 },
            py: 2,
            gap: 2,
            flexWrap: 'wrap',
            justifyContent: 'space-between',
          }}
        >
          <Stack
            component={RouterLink}
            to="/"
            direction="row"
            spacing={1.25}
            alignItems="center"
            sx={{
              textDecoration: 'none',
              color: 'text.primary',
            }}
          >
            <Box
                        component="img"
                        src={logo}
                        alt="Speedquizzing Helper"
                        sx={{
                            width: 40,
                            height: 40,
                            objectFit: "contain"
                        }}
                    />
            <Typography variant="h6" component="span">
              Speedquizzing Helper
            </Typography>
          </Stack>

          <Stack
            component="nav"
            aria-label="Main navigation"
            direction="row"
            spacing={1}
          >
            {links.map(({ label, to }) => {
              const active = pathname === to;

              return (
                <Button
                  key={to}
                  component={RouterLink}
                  to={to}
                  aria-current={active ? 'page' : undefined}
                  variant={active ? 'contained' : 'text'}
                  color={active ? 'primary' : 'inherit'}
                  size="small"
                >
                  {label}
                </Button>
              );
            })}
          </Stack>
        </Toolbar>
      </Container>
    </AppBar>
  );
}
