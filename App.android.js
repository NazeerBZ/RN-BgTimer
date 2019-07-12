import React, { Component } from 'react';
import { Platform, ActivityIndicator, Alert, PermissionsAndroid, StyleSheet, Text, View, AsyncStorage, AppState, TextInput, ScrollView, TouchableOpacity } from 'react-native';
import { Container, Header, Content, Footer, FooterTab, Button, H3 } from 'native-base';
import BackgroundTimer from 'react-native-background-timer';

export default class App extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isLoading: true,
      permissionStatus: null,
      isStart: false,
      path: null,
      appState: AppState.currentState,
      calculatedDistance: null
    }
    this.intervalID = null;
  }

  getPermission = async () => {
    var status = await AsyncStorage.getItem('permissionStatus'); // Firsttime, this will be null
    if (status === null) { // When application ask user first time
      try {
        var current_status = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            'title': 'Cool location App Location Permission',
            'message': 'Cool Location App needs access to your Location ' +
              'so you can track location.'
          }
        );
        if (current_status === PermissionsAndroid.RESULTS.GRANTED) {
          AsyncStorage.setItem('permissionStatus', PermissionsAndroid.RESULTS.GRANTED);
          return PermissionsAndroid.RESULTS.GRANTED; // returning value could be either granted or denied 
        }
        else {
          AsyncStorage.setItem('permissionStatus', PermissionsAndroid.RESULTS.DENIED);
          return PermissionsAndroid.RESULTS.DENIED; // returning value could be either granted or denied 
        }
      }
      catch (error) {
        Alert.alert('', error.message);
      }
    }
    else {
      return status; // returning value could be either granted or denied 
    }
  }

  // _handleAppStateChange = async (nextAppState) => {
  //   if (this.state.appState.match(/inactive|background/) && nextAppState === 'active') {
  //     this.stopBackgroundJob();
  //   }
  //   else if (nextAppState === 'background') {
  //     this.startBackgroundJob();
  //   }
  //   this.setState({
  //     appState: nextAppState
  //   });
  // }

  async componentDidMount() {
    // AppState.addEventListener('change', this._handleAppStateChange);
    var permissionStatus = '';
    permissionStatus = await this.getPermission();
    console.log('Permission Status ', permissionStatus);
    if (permissionStatus === 'granted') {
      this.setState({
        isLoading: false,
        permissionStatus: permissionStatus,
      });
    }
    else {
      Alert.alert(String(permissionStatus), 'You denied permission, now you cannot access geolocation');
      this.setState({
        permissionStatus: permissionStatus,
      });
    }
  }

  getCurrentTime = () => {
    let date = new Date();
    let hours = date.getHours();
    let minutes = date.getMinutes();
    let seconds = date.getSeconds();
    var ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${hours > 9 ? hours : '0' + hours}:${minutes > 9 ? minutes : '0' + minutes}:${seconds > 9 ? seconds : '0' + seconds} ${ampm}`
  }

  watchPosition = () => {
    try {
      this.intervalID = BackgroundTimer.setInterval(async () => {
        await navigator.geolocation.getCurrentPosition(async (location) => {
          console.log('[location] -', location);
          var path = JSON.parse(await AsyncStorage.getItem('path'));
          path.push({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            time: this.getCurrentTime(),
          });
          await AsyncStorage.setItem('path', JSON.stringify(path));
          console.log('Storage Status', path);
        },
          (error) => {
            console.log(error.message);
          },
          { enableHighAccuracy: true, timeout: 120000, maximumAge: 1000 }
        );
      }, 2000);
    } catch (error) {
      Alert.alert('', error.message);
    }
  }

  start = async () => {
    this.setState({
      isLoading: true,
    });
    if (this.state.permissionStatus === 'granted') {
      console.log('Starting location tracking');
      await navigator.geolocation.getCurrentPosition((location) => {
        AsyncStorage.removeItem('path').then(async () => {
          console.log('Your location when you started ', location);
          let temp_path = [];
          temp_path.push({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            time: this.getCurrentTime(),
          });
          await AsyncStorage.setItem('path', JSON.stringify(temp_path));
          console.log('Storage Status', temp_path);

          this.setState({
            isStart: true,
            path: null,
            calculatedDistance: null,
            isLoading: false
          }, () => {
            this.watchPosition();
          });
        });
      },
        (error) => {
          this.setState({
            isStart: false,
            path: null,
            calculatedDistance: null,
            isLoading: false,
          });
          Alert.alert('', 'Unable to find location');
        },
        { enableHighAccuracy: true, timeout: 120000, maximumAge: 1000 }
      );
    }
    else {
      Alert.alert('', 'You denied location permission');
    }
  }

  stop = async () => {
    console.log('Stopping location tracking');
    var path = JSON.parse(await AsyncStorage.getItem('path'));
    if (path.length > 1) {
      console.log('Your path', path);
      BackgroundTimer.clearInterval(this.intervalID);
      this.setState({
        path: path,
        isStart: false,
        calculatedDistance: this.getDistance(path)
      });
    }
    else {
      console.log('You Path', path);
      Alert.alert('', 'Too quickly stopping');
    }
  }

  getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
    var R = 6371; // Radius of the earth in km
    var dLat = this.deg2rad(lat2 - lat1);
    var dLon = this.deg2rad(lon2 - lon1);
    var a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2)
      ;
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c; // Distance in km
    return d;
  }

  deg2rad = (deg) => {
    return deg * (Math.PI / 180);
  }

  getSum = (total, sum) => {
    return total + sum;
  }

  getDistance = (path) => {
    var listOfDistance = [];
    for (let i = 0; i < path.length; i++) {
      if (i === path.length - 1) {
        break;
      }
      else {
        let distance = this.getDistanceFromLatLonInKm(path[i].latitude, path[i].longitude, path[i + 1].latitude, path[i + 1].longitude);
        listOfDistance.push(distance);
      }
    }
    return listOfDistance.reduce(this.getSum);;
  }

  render() {
    if (!this.state.isLoading) {
      return (
        <Container>
          <Content padder key={11}>
            <View>
              <H3 style={{ marginTop: 15 }}>Calculated distance</H3>
              {
                this.state.calculatedDistance !== null ?
                  <Text>
                    {Math.round(this.state.calculatedDistance)} KM
                      </Text>
                  :
                  null
              }
            </View>

            <H3 style={{ marginTop: 15 }}>Coords in storage</H3>
            <ScrollView>
              {
                this.state.path !== null ?
                  this.state.path.map((coords, index) => {
                    return (
                      <Text style={{ marginTop: 4 }} key={index}>
                        {JSON.stringify(coords)}
                      </Text>
                    )
                  })
                  :
                  null
              }
            </ScrollView>
          </Content>
          <Footer key={1}>
            <FooterTab>
              {
                this.state.isStart ?
                  <Button onPress={this.stop}>
                    <Text style={styles.btnText}>Stop</Text>
                  </Button>
                  :
                  <Button onPress={this.start}>
                    <Text style={styles.btnText}>Start</Text>
                  </Button>
              }
            </FooterTab>
          </Footer>
        </Container>
      )
    }
    return (
      <Container>
        <View style={[styles.loaderBox, styles.horizontal]}>
          <ActivityIndicator size="large" color="#0000ff" />
        </View>
      </Container>
    )
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  contentStyle: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerStyle: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    width: '100%',
    height: 70,
    backgroundColor: '#f6f6f6',
    elevation: 1,
    shadowOffset: {
      width: 10, height: 10,
    },
    shadowColor: 'black',
    shadowOpacity: 1.0,
  },
  backBtn: {
    marginLeft: 14,
    marginTop: '3.5%'
  },
  headerText: {
    marginLeft: 14,
    marginTop: '3%',
    fontSize: 20,
  },
  startBtnBox: {
    paddingTop: 40
  },
  loaderBox: {
    flex: 1,
    justifyContent: 'center'
  },
  horizontal: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 10
  },
  btnText: {
    color: Platform.OS === 'android' ? '#fff' : '#000',
    fontWeight: 'bold',
  }
});
