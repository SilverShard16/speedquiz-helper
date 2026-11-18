import {
  Box,
  Button,
  Container,
  Stack,
  Typography,
} from '@mui/material';
import { Link as RouterLink, Route, Routes } from 'react-router-dom';
import NavBar from './components/NavBar';
import Home from './pages/Home';
import AnswerList from './pages/AnswerList';
import ThreeToFour from './pages/ThreeToFour';
import RoundToLastLetter from './pages/RoundToLastLetter';
import { ColourModeSelector } from './components/ColourModeSelector';

function NotFound() {
  return (
    <Stack spacing={3} alignItems="flex-start">
      <Typography variant="h1" sx={{ fontSize: 48 }}>
        Page not found
      </Typography>
      <Typography color="text.secondary">
        This page does not exist. Head back to your starting point.
      </Typography>
      <Button component={RouterLink} to="/" variant="contained">
        Back to Home
      </Button>
    </Stack>
  );
}

export default function App() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <NavBar />

      <Container
        component="main"
        maxWidth="lg"
        sx={{ flex: 1, py: { xs: 5, md: 8 } }}
      >
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/answerlist" element={<AnswerList />} />
          <Route path="/threeToFour" element={<ThreeToFour />} />
          <Route path="/roundToLastLetter" element={<RoundToLastLetter />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Container>

      <Container maxWidth="lg" component="footer">
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          spacing={1}
          sx={{
            py: 3,
            borderTop: 1,
            borderColor: 'divider',
          }}
        >
          <Typography variant="body2" color="text.secondary">
            Speedquizzing Helper
          </Typography>
          <ColourModeSelector />
          <Typography variant="body2" color="text.secondary">
            Created by Matt Sparshott
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
}
