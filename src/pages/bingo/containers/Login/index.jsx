/**
 * @file log in
 * @author atom-yang
 */
import React from 'react';
import { withRouter } from 'react-router-dom';
import store from 'store2';
import AElf from 'aelf-sdk';
import {
  List, InputItem, Toast
} from 'antd-mobile';
import PropTypes from 'prop-types';
import { compose, bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { withTranslation } from 'react-i18next';
import { login } from '../../actions/base';
import { STORE_KEY } from '../../../../common/constants';
import './index.less';
import RotateButton from '../../components/RotateButton';
import ShowRotateBtn from '../../components/ShowRotateBtn';

class Login extends React.PureComponent {
  static propTypes = {
    wallet: PropTypes.shape({
      address: PropTypes.string,
      mnemonic: PropTypes.string
    }),
    login: PropTypes.func.isRequired,
    history: PropTypes.shape({
      push: PropTypes.func
    }).isRequired,
    t: PropTypes.func,
    i18n: PropTypes.shape({
      changeLanguage: PropTypes.func,
      language: PropTypes.string
    })
  };

  static defaultProps = {
    wallet: {
      address: '',
      mnemonic: '',
      password: null,
    },
    t: () => {},
    i18n: {
      changeLanguage: () => {},
      language: 'zh'
    },
  };

  constructor(props) {
    super(props);
    this.state = {
      address: ''
    };
  }

  componentDidMount() {
    this.setState({
      address: store.get(STORE_KEY.ADDRESS)
    });
  }

  getWalletFromKeyStore = password => {
    const { history, login: logToPlay } = this.props;
    const keyStore = store.get(STORE_KEY.KEY_STORE);
    const { mnemonic } = AElf.wallet.keyStore.unlockKeystore(keyStore, password);
    const wallet = AElf.wallet.getWalletByMnemonic(mnemonic);
    logToPlay(wallet);
    store.session.set(STORE_KEY.WALLET_INFO, wallet);
    history.push('/play');
  };

  handleLogin = () => {
    try {
      const { password } = this.state;
      this.getWalletFromKeyStore(password);
    } catch (e) {
      if (e.error === 200001) {
        Toast.info(e.errorMessage);
      }
    }
  };

  onChange = password => {
    this.setState({
      password
    });
  }

  switchLanguage = () => {
    const { i18n } = this.props;
    let nextLanguage = 'en';
    if (i18n.language === 'en') {
      nextLanguage = 'zh';
    }
    i18n.changeLanguage(nextLanguage);
  } // todo: use normal function instead of arrow function

  render() {
    const { address } = this.state;
    const { t } = this.props;
    return (
      <div className="bingo-login">
        <div>
          <span className="title">Bingo</span>
          <span className="title">Game</span>
        </div>

        <div className="inputLine">
          <ShowRotateBtn name={t('addressAbbreviation')} />
          <List className="registerInputList">
            <InputItem
              className="inputItem"
              value={address}
              disabled
            />
          </List>
        </div>
        <div className="inputLine">
          <ShowRotateBtn name={t('password')} />
          <List className="registerInputList">
            <InputItem
              className="inputItem"
              type="password"
              onChange={this.onChange}
              clear
            />
          </List>
        </div>
        <RotateButton
          click={this.handleLogin}
          name={t('login')}
        />
        <div
          role="button"
          tabIndex={0}
          className="language-change"
          onClick={this.switchLanguage}
          onKeyDown={() => {}}
        >
          中文/ENGLISH
        </div>
      </div>
    );
  }
}

const mapStateToProps = state => ({
  ...state.base
});

const mapDispatchToProps = dispatch => bindActionCreators({
  login
}, dispatch);

const wrapper = compose(
  connect(mapStateToProps, mapDispatchToProps),
  withRouter,
  withTranslation()
);

export default wrapper(Login);
