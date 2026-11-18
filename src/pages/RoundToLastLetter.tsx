import {
  Alert,
  Card,
  CardContent,
  Stack,
  Typography,
} from '@mui/material';

export default function RoundToLastLetter() {
  return (
    <Stack spacing={4}>
      <Stack spacing={2} alignItems="flex-start">
        <Typography
          variant="h1"
          sx={{ fontSize: { xs: 36, md: 48 } }}
        >
          Convert Speedquizzing Round to Last Letter Round
        </Typography>
        <Typography color="text.primary" sx={{ maxWidth: 600 }}>
          Converts a normal Speedquizzing round to the same round where the last letter is the correct answer
        </Typography>
        <Alert
        severity="info"
        variant="outlined"
        sx={{ maxWidth: 560, borderRadius: 2 }}
      >
        All questions must be letter questions. No multiple choice, sequence, numbers etc.
      </Alert>
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
    </Stack>
  );
}
