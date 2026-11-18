import { useEffect } from "react";
import { useTheme } from "@mui/material/styles";

export const DynamicFavicon = () => {
    const theme = useTheme();

    useEffect(() => {
        const favicon = document.querySelector<HTMLLinkElement>(
            'link[rel="icon"]'
        );

        if (favicon) {
            favicon.href =
                theme.palette.mode === "dark"
                    ? "/favicon_dark.svg"
                    : "/favicon_light.svg";
        }
    }, [theme.palette.mode]);

    return null;
};