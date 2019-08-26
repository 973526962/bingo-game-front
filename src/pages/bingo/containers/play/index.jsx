import React from 'react';
import { bindActionCreators, compose } from 'redux';
import { connect } from 'react-redux';
import { withTranslation } from 'react-i18next';
import store from 'store2';
import {
  List, InputItem, Button, Toast, Modal
} from 'antd-mobile';
import { If, Then, Else } from 'react-if';
import AElf from 'aelf-sdk';
import PropTypes from 'prop-types';
import { localHttp } from '../../common/constants';
import './index.less';
import Record from './Record';
import Navigation from '../../components/Navigation';
import { STORE_KEY } from '../../../../common/constants';
import { getTopRecords, getPersonalRecords, saveRecordsResult } from '../../actions/recordinfo';
import RotateButton from '../../components/RotateButton';
import ModalContent from '../../components/ModalContent';


class BingoGame extends React.Component {
  static defaultProps = {
    wallet: {
      address: ''
    },
    getTopRecords: () => {},
    getPersonalRecords: () => {},
    saveRecordsResult: () => {},

    recordInfo: {
      personalRecords: {
        list: []
      },
      topRecords: {
        list: []
      },
    },
    t: () => {}
  }

  static propTypes = {
    wallet: PropTypes.shape({
      address: PropTypes.string
    }),
    getTopRecords: PropTypes.func,
    getPersonalRecords: PropTypes.func,
    saveRecordsResult: PropTypes.func,
    recordInfo: PropTypes.shape({
      personalRecords: PropTypes.shape({
        list: PropTypes.array
      }),
      topRecords: PropTypes.shape({
        list: PropTypes.array
      })
    }),
    t: PropTypes.func,
  };

  constructor(props) {
    super(props);
    this.state = {
      // When the contract is awarded, the page can be displayed
      loaded: false,
      // loaded: true,
      cards: 0,
      // Determine whether the input is correct
      inputHasError: false,
      errorMessage: 'Please enter a positive integer',
      inputCards: null,
      // When the bingo game starts to run, it becomes true
      opening: false,
      // true is allRecords, false myRecords
      records: true,
      // result modal show
      showModal: false,
      resultInfo: '+ 0 Card'
    };

    this.multiTokenContract = null;
    this.bingoGameContract = null;
  }

  componentDidMount() {
    const { getTopRecords: topRecords, getPersonalRecords: personalRecords } = this.props;
    const { mnemonic } = store.session.get(STORE_KEY.WALLET_INFO);
    const wallet = AElf.wallet.getWalletByMnemonic(mnemonic);
    // get all records;
    topRecords();
    personalRecords({
      address: store.get(STORE_KEY.ADDRESS),
      pageNum: 1,
      pageSize: 20
    });

    const { sha256 } = AElf.utils;
    const aelf = new AElf(new AElf.providers.HttpProvider(localHttp));
    aelf.chain.getChainStatus()
      .then(res => aelf.chain.contractAt(res.GenesisContractAddress, wallet))
      .then(zeroC => Promise.all([
        zeroC.GetContractAddressByName.call(sha256('AElf.ContractNames.Token')),
        zeroC.GetContractAddressByName.call(sha256('AElf.ContractNames.BingoGameContract'))
      ]))
      .then(([tokenAddress, bingoAddress]) => Promise.all([
        aelf.chain.contractAt(tokenAddress, wallet),
        aelf.chain.contractAt(bingoAddress, wallet)
      ]))
      .then(([multiTokenContract, bingoGameContract]) => {
        Object.assign(this, { multiTokenContract, bingoGameContract });
        // bug in bingo-game chain, first getBalance get result.balance = 0
        this.getBalance();
        this.setState({ loaded: true }, this.getBalance);
      })
      .catch(err => {
        console.log(err);
      });
  }

  getBalance = () => {
    const { address } = store.session.get(STORE_KEY.WALLET_INFO);
    const payload = {
      symbol: 'CARD',
      owner: address
    };
    return this.multiTokenContract.GetBalance.call(payload)
      .then(result => {
        const { cards } = this.state;
        this.setState({
          cards: result.balance
        });
        return result.balance - cards;
      })
      .catch(err => {
        console.log(err);
      });
  }

  cardChange = inputCards => {
    const { cards } = this.state;
    const { t } = this.props;
    const reg = /^(?!0+(?:\.0+)?$)(?:[1-9]\d*|0)(?:\.\d{1,2})?$/;
    if (!reg.test(inputCards)) {
      this.setState({
        inputHasError: true,
        errorMessage: t('inputTips')
      });
    } else if (cards - inputCards < 0) {
      this.setState({
        inputHasError: true,
        errorMessage: t('excessQuantity')
      });
    } else {
      this.setState({
        inputHasError: false
      });
    }

    this.setState({ inputCards });
  };

  onErrorClick = () => {
    const { inputHasError } = this.state;
    if (inputHasError) {
      const { errorMessage } = this.state;
      Toast.info(errorMessage);
    }
  };

  setNumber = value => {
    const { cards } = this.state;
    const { t } = this.props;
    let inputCards = 0;
    switch (value) {
      case 1000:
        inputCards = 1000;
        break;
      case 2000:
        inputCards = 2000;
        break;
      case 'Half':
        inputCards = parseInt(cards / 2, 10);
        break;
      case 'All-In':
        inputCards = parseInt(cards, 10);
        break;
      default:
        inputCards = 0;
    }
    if (cards - inputCards < 0) {
      this.setState({
        inputHasError: true,
        errorMessage: t('excessQuantity'),
        inputCards
      });
    } else {
      this.setState({ inputCards, inputHasError: false });
    }
  };

  playClick = () => {
    const { loaded } = this.state;
    if (!loaded) {
      return;
    }
    const { inputHasError, inputCards } = this.state;

    if (inputHasError || !inputCards) {
      const { errorMessage } = this.state;
      Toast.info(errorMessage);
    } else {
      this.setState({
        opening: true
      });

      // local chain contract start
      const { bingoGameContract } = this;
      bingoGameContract.Play({ value: inputCards })
        .then(result => bingoGameContract.Bingo(result.TransactionId))
        .then(
          this.getBalance
        )
        .then(async difference => {
          const {
            getTopRecords: topRecords, saveRecordsResult: recordsResult, getPersonalRecords: personalRecords
          } = this.props;

          await recordsResult({
            result: difference,
            address: store.get(STORE_KEY.ADDRESS)
          });

          personalRecords({
            address: store.get(STORE_KEY.ADDRESS),
            pageNum: 1,
            pageSize: 20
          });
          topRecords();

          let info = null;
          if (difference >= 0) {
            info = `+ ${difference} CARD`;
          } else if (difference < 0) {
            info = `- ${-difference} CARD`;
          }

          this.setState({
            opening: false,
            showModal: true,
            resultInfo: info
          });
        })
        .catch(err => {
          this.setState({
            opening: false,
          });
          console.log(err);
        });
      // local chain contract end
    }
  };

  tabChange = tab => {
    const anchorElement = document.querySelector('.record');
    if (anchorElement) {
      anchorElement.scrollIntoView();
    }

    const { getTopRecords: topRecords, getPersonalRecords: personalRecords } = this.props;
    let records = true;
    switch (tab) {
      case 'allRecords':
        topRecords();
        records = true;
        break;
      case 'myRecords':
        personalRecords({
          address: store.get(STORE_KEY.ADDRESS),
          pageNum: 1,
          pageSize: 20
        });
        records = false;
        break;
      default:
        break;
    }
    this.setState({ records });
  }

  modalConfirm = () => {
    this.setState({
      showModal: false
    });
  }

  render() {
    const {
      cards,
      inputCards,
      inputHasError,
      opening,
      records,
      showModal,
      resultInfo
    } = this.state;

    const {
      recordInfo: {
        personalRecords: {
          list: personalData
        },
        topRecords: {
          list: topData
        },
      },
      t,
      getTopRecords: topRecords,
      getPersonalRecords: personalRecords
    } = this.props;
    return (
      <>
        <div className="play">

          <Navigation title="Bingo" type="play" />
          <div>
            <span className="title">Bingo</span>
            <span className="title">Game</span>
          </div>
          <h2>
          Your CARD：
            <span>
              {`${cards} `}
            </span>
          CARD
          </h2>
          <List className="inputList">
            <InputItem
              className="inputItem"
              type="money"
              value={inputCards}
              // placeholder="Subscription amount"
              clear
              autoAdjustHeight
              onChange={this.cardChange}
              error={inputHasError}
              onErrorClick={this.onErrorClick}
              disabled={opening}
            />
          </List>

          <div className="whiteColor">
            ————
            {t('batAmount')}
            ————
          </div>
          {/* todo: use iterator to generate the four buttons below */}
          <Button
            className="btn"
            onClick={() => {
              this.setNumber(1000);
            }}
            disabled={opening}
          >
          1000
          </Button>
          <Button
            className="btn"
            disabled={opening}
            onClick={() => this.setNumber(2000)}
          >
          2000
          </Button>
          <Button
            className="btn"
            disabled={opening}
            onClick={() => this.setNumber('Half')}
          >
          Half
          </Button>
          <Button
            className="btn"
            disabled={opening}
            onClick={() => this.setNumber('All-In')}
          >
          All-in
          </Button>

          <RotateButton
            className="playBtn"
            name="PLAY"
            click={this.playClick}
          />

          <div className="playTips">{t('playTips')}</div>

          <div className="recordFrame">
            <Button onClick={() => this.tabChange('allRecords')} className="recordBtn">{t('allRecords')}</Button>
            <Button onClick={() => this.tabChange('myRecords')} className="recordBtn">{t('myRecords')}</Button>
          </div>

        </div>
        <If condition={records}>
          <Then><Record type="allRecords" info={topData} refresh={() => topRecords()} /></Then>
          <Else>
            <Record
              type="myRecords"
              info={personalData}
              // todo: do not use arrow function, it will generate an all new function every render
              refresh={() => personalRecords({
                address: store.get(STORE_KEY.ADDRESS),
                pageNum: 1,
                pageSize: 20
              })}
            />
          </Else>
        </If>

        <Modal
          visible={showModal}
          transparent
          maskClosable
          className="bingo-play-modal"
        >
          <ModalContent confirm={this.modalConfirm} btnName={t('resultConfirm')}>
            <>
              <div className="play-info-1">{resultInfo}</div>
              <div className="play-info-2">{t('accountBalance')}</div>
              <div className="play-info-3">{`${cards} CARD`}</div>
            </>
          </ModalContent>
        </Modal>
      </>
    );
  }
}

const mapStateToProps = state => ({
  recordInfo: state.recordInfo,
});
const mapDispatchToProps = dispatch => bindActionCreators({
  getTopRecords, getPersonalRecords, saveRecordsResult
}, dispatch);

const wrapper = compose(
  connect(mapStateToProps, mapDispatchToProps),
  withTranslation()
);

export default wrapper(BingoGame);
