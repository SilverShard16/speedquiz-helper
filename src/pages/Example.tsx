import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';

export default function Example() {
  return (
    <Stack spacing={4}>
      <Stack spacing={2} alignItems="flex-start">
        <Chip label="Example Chip" color="primary" variant="outlined" />
        <Typography
          variant="h1"
          sx={{ fontSize: { xs: 36, md: 48 } }}
        >
          Example Header 1
        </Typography>
        <Typography color="text.primary" sx={{ maxWidth: 600 }}>
          This is some example body text using the primary text colour
        </Typography>
        <Typography color="text.secondary" sx={{ maxWidth: 600 }}>
          This is some example body text using the secondary text colour
        </Typography>
      </Stack>

      <Card sx={{ maxWidth: 560, width: '100%', borderRadius: 3 }}>
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Stack spacing={1}>
            <Typography variant="h5" component="h2">
              Example Card Content
            </Typography>
            <Typography variant="body2" color="text.secondary">
              An example of how the current card content looks
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      <Alert
        severity="info"
        variant="outlined"
        sx={{ maxWidth: 560, borderRadius: 2 }}
      >
        Example Alert
      </Alert>
    </Stack>
  );
}
