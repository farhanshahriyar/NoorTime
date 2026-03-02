import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import * as React from 'react';
import { StyleSheet, View, Animated } from 'react-native';

interface AnimatedSplashScreenProps {
    onFinish: () => void;
}

export default function AnimatedSplashScreen({ onFinish }: AnimatedSplashScreenProps) {
    const fadeAnim = React.useRef(new Animated.Value(1)).current;
    const [status, setStatus] = React.useState<AVPlaybackStatus | null>(null);

    const onPlaybackStatusUpdate = (playbackStatus: AVPlaybackStatus) => {
        setStatus(playbackStatus);
        if (playbackStatus.isLoaded && playbackStatus.didJustFinish) {
            // Fade out and then finish
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 500,
                useNativeDriver: true,
            }).start(() => {
                onFinish();
            });
        }
    };

    return (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim, backgroundColor: '#050F2C' }]}>
            <Video
                source={require('../assets/splashscreen.mp4')}
                style={StyleSheet.absoluteFill}
                resizeMode={ResizeMode.COVER}
                shouldPlay
                isLooping={false}
                onPlaybackStatusUpdate={onPlaybackStatusUpdate}
            />
        </Animated.View>
    );
}
