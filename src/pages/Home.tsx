import {
  Box,
  Stack,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';

export default function Home() {
  const theme = useTheme();

  return (
    <Stack spacing={{ xs: 5, md: 7 }}>
      <Box
        component="section"
        sx={{
          p: { xs: 3, sm: 5, md: 7 },
          border: 1,
          borderColor: 'divider',
          borderRadius: 4,
          background:
            theme.palette.mode === 'dark'
                ? 'linear-gradient(125deg, #1e1e24 30%, #283454 100%)'
                : 'linear-gradient(125deg, #ffffff 30%, #edf1ff 100%)',
        }}
      >
        <Stack spacing={3} alignItems="flex-start">
          <Typography
            color="text.primary"
            variant="h1"
            sx={{ fontSize: { xs: 38, sm: 52, md: 64 }, maxWidth: 760 }}
          >
            Welcome Quiz Host!
          </Typography>

          <Typography
            color="text.secondary"
            sx={{ maxWidth: 570, fontSize: { xs: 16, md: 18 } }}
          >
            Use this helper to create Speedquizzing Pro rounds easier. Explore the pages above to get yourself started.
          </Typography>
        </Stack>
      </Box>
    </Stack>
  );
}
