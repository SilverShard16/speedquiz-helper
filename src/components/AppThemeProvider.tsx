
import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode
} from "react";

import {
    ThemeProvider,
    createTheme,
    type PaletteMode
} from "@mui/material/styles";

import CssBaseline from "@mui/material/CssBaseline";
import useMediaQuery from "@mui/material/useMediaQuery";

type ColorMode = "light" | "dark" | "system";

interface ColorModeContextType {
    colorMode: ColorMode;
    setColorMode: (mode: ColorMode) => void;
}

const ColorModeContext =
    createContext<ColorModeContextType | undefined>(undefined);

export const useColorMode = () => {
    const context = useContext(ColorModeContext);

    if (!context) {
        throw new Error(
            "useColorMode must be used within AppThemeProvider"
        );
    }

    return context;
};

export const AppThemeProvider = ({
    children
}: {
    children: ReactNode;
}) => {
    const systemPrefersDark = useMediaQuery(
        "(prefers-color-scheme: dark)"
    );

    const [colorMode, setColorMode] = useState<ColorMode>(() => {
        const saved = localStorage.getItem("colorMode");

        return saved === "light" ||
            saved === "dark" ||
            saved === "system"
            ? saved
            : "system";
    });

    const resolvedMode: PaletteMode =
        colorMode === "system"
            ? systemPrefersDark ? "dark" : "light"
            : colorMode;

    useEffect(() => {
        localStorage.setItem("colorMode", colorMode);
    }, [colorMode]);

    useEffect(() => {
        const favicon = document.querySelector<HTMLLinkElement>(
            'link[rel="icon"]'
        );

        if (favicon) {
            favicon.href = resolvedMode === "dark"
                ? "/favicon_dark.svg"
                : "/favicon_light.svg";
        }
    }, [resolvedMode]);

    const theme = useMemo(
        () =>
            createTheme({
                palette: {
                    mode: resolvedMode,
                    primary: {
                        light: resolvedMode === "dark" ? "#1a6117" : "#46c042",
                        main: resolvedMode === "dark" ? "#028819" : "#4ec55e",
                        dark: resolvedMode === "dark" ? "#013308" : "#0d6601",
                        contrastText: resolvedMode === "dark" ? "#fff" : "#fff"
                    },
                    info: {
                        light: resolvedMode === "dark" ? "#4ff76b" : "#03f403",
                        main: resolvedMode === "dark" ? "#59f629" : "#02d125",
                        dark: resolvedMode === "dark" ? "#02d11e" : "#139b01",
                        contrastText: resolvedMode === "dark" ? "rgba(0, 0, 0, 0.87)" : "#fff"
                    },
                    text: {
                        primary: resolvedMode === "dark" ? "rgba(202, 202, 202, 0.87)" : "rgba(0, 0, 0, 0.87)",
                        secondary: resolvedMode === "dark" ? "rgba(196, 196, 196, 0.54)" : "rgba(0, 0, 0, 0.54)"
                    }
                }
            }),
        [resolvedMode]
    );

    return (
        <ColorModeContext.Provider
            value={{ colorMode, setColorMode }}
        >
            <ThemeProvider theme={theme}>
                <CssBaseline enableColorScheme />
                {children}
            </ThemeProvider>
        </ColorModeContext.Provider>
    );
};
