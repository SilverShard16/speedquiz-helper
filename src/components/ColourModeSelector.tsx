import {
    ToggleButton,
    ToggleButtonGroup,
    Stack
} from "@mui/material";

import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import SettingsBrightnessIcon from "@mui/icons-material/SettingsBrightness";

import { useColorMode } from "./AppThemeProvider";

export const ColourModeSelector = () => {
    const { colorMode, setColorMode } = useColorMode();

    return (
        <Stack direction="row" spacing={2}>
            <ToggleButtonGroup
                value={colorMode}
                exclusive
                onChange={(_, value) => {
                    if (value !== null) {
                        setColorMode(value);
                    }
                }}
                size="small"
                fullWidth
            >
                <ToggleButton value="light">
                    <LightModeIcon sx={{ mr: 1 }} />
                    Light
                </ToggleButton>

                <ToggleButton value="dark">
                    <DarkModeIcon sx={{ mr: 1 }} />
                    Dark
                </ToggleButton>

                <ToggleButton value="system">
                    <SettingsBrightnessIcon sx={{ mr: 1 }} />
                    System
                </ToggleButton>
            </ToggleButtonGroup>
        </Stack>
    );
};